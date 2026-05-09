use std::path::PathBuf;
use std::time::Duration;
use chromiumoxide::Browser;
use chromiumoxide::browser::BrowserConfig;
use chromiumoxide::cdp::browser_protocol::page::{PrintToPdfParams, CaptureScreenshotFormat};
use chromiumoxide::page::ScreenshotParams;
use futures_util::stream::StreamExt;
use tauri::{AppHandle, Manager};

const BROWSER_TIMEOUT: Duration = Duration::from_secs(30);

fn find_bundled_chromium(app: &AppHandle) -> Option<PathBuf> {
    // Check in resource directory (for bundled app)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let chromium_dir = resource_dir.join("chromium");
        #[cfg(target_os = "windows")]
        let path = chromium_dir.join("chrome-win").join("chrome.exe");
        #[cfg(target_os = "macos")]
        let path = chromium_dir.join("chrome-mac").join("Chromium.app").join("Contents").join("MacOS").join("Chromium");
        #[cfg(target_os = "linux")]
        let path = chromium_dir.join("chrome-linux").join("chrome");

        if path.exists() {
            return Some(path);
        }
    }

    // Check next to the executable (for development/portable)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let chromium_dir = exe_dir.join("chromium");
            #[cfg(target_os = "windows")]
            let path = chromium_dir.join("chrome-win").join("chrome.exe");
            #[cfg(target_os = "macos")]
            let path = chromium_dir.join("chrome-mac").join("Chromium.app").join("Contents").join("MacOS").join("Chromium");
            #[cfg(target_os = "linux")]
            let path = chromium_dir.join("chrome-linux").join("chrome");

            if path.exists() {
                return Some(path);
            }
        }
    }

    None
}

fn find_system_browser() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let paths = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Chromium\Application\chrome.exe",
            r"C:\Program Files (x86)\Chromium\Application\chrome.exe",
            r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
        ];
        for p in &paths {
            if std::path::Path::new(p).exists() {
                return Some(PathBuf::from(p));
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        let paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ];
        for p in &paths {
            if std::path::Path::new(p).exists() {
                return Some(PathBuf::from(p));
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        let names = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"];
        if let Ok(path) = std::env::var("PATH") {
            for dir in path.split(':') {
                for name in &names {
                    let full = PathBuf::from(dir).join(name);
                    if full.exists() {
                        return Some(full);
                    }
                }
            }
        }
    }
    None
}

fn get_browser_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(path) = find_bundled_chromium(app) {
        eprintln!("Using bundled Chromium: {:?}", path);
        return Ok(path);
    }
    if let Some(path) = find_system_browser() {
        eprintln!("Using system browser: {:?}", path);
        return Ok(path);
    }
    Err("未找到浏览器。请确保应用已正确安装，或系统中安装了 Chrome/Edge。".into())
}

async fn launch_browser(app: &AppHandle) -> Result<(Browser, tokio::task::JoinHandle<()>), String> {
    let browser_path = get_browser_path(app)?;

    let config = BrowserConfig::builder()
        .chrome_executable(&browser_path)
        .arg("--headless=new")
        .arg("--no-first-run")
        .arg("--disable-gpu")
        .arg("--disable-extensions")
        .arg("--no-sandbox")
        .arg("--disable-dev-shm-usage")
        .build()
        .map_err(|e| format!("浏览器配置错误: {e}"))?;

    let (browser, mut handler) = tokio::time::timeout(
        BROWSER_TIMEOUT,
        Browser::launch(config)
    ).await
        .map_err(|_| "浏览器启动超时".to_string())?
        .map_err(|e| format!("浏览器启动失败: {e}"))?;

    let handle = tokio::spawn(async move {
        while handler.next().await.is_some() {}
    });

    Ok((browser, handle))
}

async fn cleanup_browser(mut browser: Browser, handle: tokio::task::JoinHandle<()>) {
    let _ = tokio::time::timeout(Duration::from_secs(5), browser.close()).await;
    handle.abort();
}

#[tauri::command]
pub async fn export_pdf(app: AppHandle, html: String) -> Result<Vec<u8>, String> {
    let (browser, handle) = launch_browser(&app).await?;

    let result = async {
        let page = tokio::time::timeout(
            BROWSER_TIMEOUT,
            browser.new_page("about:blank")
        ).await
            .map_err(|_| "创建页面超时".to_string())?
            .map_err(|e| format!("创建页面失败: {e}"))?;

        tokio::time::timeout(
            BROWSER_TIMEOUT,
            page.set_content(&html)
        ).await
            .map_err(|_| "加载内容超时".to_string())?
            .map_err(|e| format!("加载内容失败: {e}"))?;

        tokio::time::timeout(
            BROWSER_TIMEOUT,
            page.pdf(PrintToPdfParams {
                print_background: Some(true),
                prefer_css_page_size: Some(true),
                ..Default::default()
            })
        ).await
            .map_err(|_| "PDF生成超时".to_string())?
            .map_err(|e| format!("PDF生成失败: {e}"))
    }.await;

    cleanup_browser(browser, handle).await;

    result
}

#[tauri::command]
pub async fn capture_html_png(app: AppHandle, html: String) -> Result<Vec<u8>, String> {
    let (browser, handle) = launch_browser(&app).await?;

    let result = async {
        let page = tokio::time::timeout(
            BROWSER_TIMEOUT,
            browser.new_page("about:blank")
        ).await
            .map_err(|_| "创建页面超时".to_string())?
            .map_err(|e| format!("创建页面失败: {e}"))?;

        tokio::time::timeout(
            BROWSER_TIMEOUT,
            page.set_content(&html)
        ).await
            .map_err(|_| "加载内容超时".to_string())?
            .map_err(|e| format!("加载内容失败: {e}"))?;

        let screenshot_params = ScreenshotParams::builder()
            .format(CaptureScreenshotFormat::Png)
            .full_page(true)
            .build();

        tokio::time::timeout(
            BROWSER_TIMEOUT,
            page.screenshot(screenshot_params)
        ).await
            .map_err(|_| "截图超时".to_string())?
            .map_err(|e| format!("截图失败: {e}"))
    }.await;

    cleanup_browser(browser, handle).await;

    result
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn capture_region_png(
    window: tauri::WebviewWindow,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    scale: f64,
) -> Result<Vec<u8>, String> {
    use image::{codecs::png::PngEncoder, ColorType, ImageEncoder};
    use windows::Win32::Foundation::POINT;
    use windows::Win32::Graphics::Gdi::{
        BitBlt, ClientToScreen, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC,
        DeleteObject, GetDC, GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER,
        BI_RGB, DIB_RGB_COLORS, HGDIOBJ, SRCCOPY,
    };

    let hwnd = window.hwnd().map_err(|e| format!("Failed to get HWND: {e}"))?;

    let width_px = (width * scale).round() as i32;
    let height_px = (height * scale).round() as i32;
    let x_px = (x * scale).round() as i32;
    let y_px = (y * scale).round() as i32;

    if width_px <= 0 || height_px <= 0 {
        return Err("Invalid capture size".into());
    }

    if width_px > 16384 || height_px > 16384 {
        return Err("Capture size too large (max 16384px)".into());
    }

    let mut origin = POINT { x: 0, y: 0 };
    unsafe {
        if !ClientToScreen(hwnd, &mut origin).as_bool() {
            return Err("ClientToScreen failed".into());
        }
    }

    let src_x = origin.x + x_px;
    let src_y = origin.y + y_px;

    unsafe {
        let screen_dc = GetDC(None);
        if screen_dc.0.is_null() {
            return Err("GetDC failed".into());
        }

        let mem_dc = CreateCompatibleDC(Some(screen_dc));
        if mem_dc.0.is_null() {
            let _ = ReleaseDC(None, screen_dc);
            return Err("CreateCompatibleDC failed".into());
        }

        let bitmap = CreateCompatibleBitmap(screen_dc, width_px, height_px);
        if bitmap.0.is_null() {
            let _ = DeleteDC(mem_dc);
            let _ = ReleaseDC(None, screen_dc);
            return Err("CreateCompatibleBitmap failed".into());
        }

        let old_obj = SelectObject(mem_dc, HGDIOBJ(bitmap.0));
        if old_obj.0.is_null() {
            let _ = DeleteObject(bitmap.into());
            let _ = DeleteDC(mem_dc);
            let _ = ReleaseDC(None, screen_dc);
            return Err("SelectObject failed".into());
        }

        let blt_ok = BitBlt(mem_dc, 0, 0, width_px, height_px, Some(screen_dc), src_x, src_y, SRCCOPY);
        if blt_ok.is_err() {
            let _ = SelectObject(mem_dc, old_obj);
            let _ = DeleteObject(bitmap.into());
            let _ = DeleteDC(mem_dc);
            let _ = ReleaseDC(None, screen_dc);
            return Err("BitBlt failed".into());
        }

        let mut bmi = BITMAPINFO::default();
        bmi.bmiHeader = BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width_px,
            biHeight: -height_px,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        };

        let mut bgra = vec![0u8; (width_px * height_px * 4) as usize];
        let rows = GetDIBits(
            mem_dc,
            bitmap,
            0,
            height_px as u32,
            Some(bgra.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        let _ = SelectObject(mem_dc, old_obj);
        let _ = DeleteObject(bitmap.into());
        let _ = DeleteDC(mem_dc);
        let _ = ReleaseDC(None, screen_dc);

        if rows == 0 {
            return Err("GetDIBits failed".into());
        }

        let mut rgba = vec![0u8; bgra.len()];
        for (src, dst) in bgra.chunks_exact(4).zip(rgba.chunks_exact_mut(4)) {
            dst[0] = src[2];
            dst[1] = src[1];
            dst[2] = src[0];
            dst[3] = 255;
        }

        let mut png = Vec::new();
        let encoder = PngEncoder::new(&mut png);
        encoder
            .write_image(&rgba, width_px as u32, height_px as u32, ColorType::Rgba8.into())
            .map_err(|e| format!("PNG encode failed: {e}"))?;
        Ok(png)
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn capture_region_png(
    _window: tauri::WebviewWindow,
    _x: f64,
    _y: f64,
    _width: f64,
    _height: f64,
    _scale: f64,
) -> Result<Vec<u8>, String> {
    Err("capture_region_png is only implemented on Windows".into())
}

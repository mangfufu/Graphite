use std::path::PathBuf;
use std::process::Command;

/// Find Microsoft Edge installation path by checking common Windows locations.
fn find_edge() -> Option<PathBuf> {
    let paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Microsoft\EdgeCore\Application\msedge.exe",
        r"C:\Program Files\Microsoft\EdgeCore\Application\msedge.exe",
    ];
    for p in &paths {
        if std::path::Path::new(p).exists() {
            return Some(PathBuf::from(p));
        }
    }
    None
}

/// Export HTML content to PDF using Edge's headless print-to-pdf capability.
///
/// This writes the HTML to a temporary file, spawns Edge in headless mode
/// to convert it to PDF, reads the generated PDF bytes, cleans up temp files,
/// and returns the bytes to the frontend.
#[tauri::command]
pub fn export_pdf(html: String) -> Result<Vec<u8>, String> {
    let edge_path = find_edge().ok_or_else(|| "Edge not found on this system".to_string())?;

    // Create temp files with unique names (scoped by process ID)
    let temp_dir = std::env::temp_dir();
    let pid = std::process::id();
    let html_path = temp_dir.join(format!("graphite_export_{}.html", pid));
    let pdf_path = temp_dir.join(format!("graphite_export_{}.pdf", pid));

    // Write HTML content to a temp file
    std::fs::write(&html_path, &html).map_err(|e| format!("Failed to write temp HTML file: {}", e))?;

    // Run Edge headless to convert HTML to PDF
    let result = Command::new(&edge_path)
        .arg("--headless")
        .arg(format!("--print-to-pdf={}", pdf_path.display()))
        .arg("--print-to-pdf-no-header-footer")
        .arg("--no-printing-headers")
        .arg("--no-first-run")
        .arg("--disable-gpu")
        .arg("--disable-extensions")
        .arg(html_path.to_str().unwrap())
        .output()
        .map_err(|e| format!("Failed to launch Edge: {}", e))?;

    // Edge --headless can return non-zero exit status even on success,
    // so we check for PDF file existence instead of relying solely on exit status.
    if pdf_path.exists() {
        let pdf_bytes =
            std::fs::read(&pdf_path).map_err(|e| format!("Failed to read generated PDF: {}", e))?;

        // Clean up temp files
        let _ = std::fs::remove_file(&html_path);
        let _ = std::fs::remove_file(&pdf_path);

        Ok(pdf_bytes)
    } else {
        let stderr = String::from_utf8_lossy(&result.stderr);
        let stdout = String::from_utf8_lossy(&result.stdout);
        Err(format!(
            "PDF was not generated.\nEdge stdout: {}\nEdge stderr: {}",
            stdout, stderr
        ))
    }
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

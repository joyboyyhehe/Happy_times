from PIL import Image
import os
import base64
from io import BytesIO

def main():
    img_path = r"C:\Users\prath\.gemini\antigravity-ide\brain\6c57999a-2afc-4a67-8bb8-781723e45761\media__1780589107399.png"
    if not os.path.exists(img_path):
        print(f"Source image not found at {img_path}!")
        return

    print("Opening source image...")
    img = Image.open(img_path).convert("RGBA")

    # Crop to the actual logo bounds to remove empty transparent space
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        print("Cropped logo to contents bounding box.")

    # Add 8% padding to avoid tight clipping
    w, h = img.size
    pad = int(max(w, h) * 0.08)
    padded_w = w + 2 * pad
    padded_h = h + 2 * pad
    
    padded_img = Image.new("RGBA", (padded_w, padded_h), (0, 0, 0, 0))
    padded_img.paste(img, (pad, pad))
    print(f"Added {pad}px transparent padding (Original: {w}x{h}, Padded: {padded_w}x{padded_h}).")
    img = padded_img

    # Destination paths for PWA and website resources
    destinations = {
        r"C:\Happytimes\happytimes-pwa\public\logo.png": None,
        r"C:\Happytimes\happytimes-pwa\src\assets\logo.png": None,
        
        # PWA Android and Standard icons
        r"C:\Happytimes\happytimes-pwa\public\icon-192.png": (192, 192),
        r"C:\Happytimes\happytimes-pwa\public\pwa-192x192.png": (192, 192),
        r"C:\Happytimes\happytimes-pwa\public\icon-512.png": (512, 512),
        r"C:\Happytimes\happytimes-pwa\public\pwa-512x512.png": (512, 512),
        
        # Apple touch icons
        r"C:\Happytimes\happytimes-pwa\public\apple-touch-icon.png": (180, 180)
    }

    for path, size in destinations.items():
        dir_name = os.path.dirname(path)
        if not os.path.exists(dir_name):
            os.makedirs(dir_name)

        if size:
            resized_img = img.resize(size, Image.Resampling.LANCZOS)
            resized_img.save(path, "PNG")
            print(f"Saved resized image {size} to {path}")
        else:
            img.save(path, "PNG")
            print(f"Saved original padded logo to {path}")

    # Save as favicon.ico (compat format for browser fallback)
    favicon_path = r"C:\Happytimes\happytimes-pwa\public\favicon.ico"
    favicon_img = img.resize((64, 64), Image.Resampling.LANCZOS)
    favicon_img.save(favicon_path, format="ICO", sizes=[(32, 32), (48, 48), (64, 64)])
    print(f"Saved favicon.ico to {favicon_path}")

    # Save as favicon.svg with embedded transparent PNG base64
    svg_path = r"C:\Happytimes\happytimes-pwa\public\favicon.svg"
    svg_png = img.resize((256, 256), Image.Resampling.LANCZOS)
    buffered = BytesIO()
    svg_png.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%">
  <image href="data:image/png;base64,{img_str}" x="0" y="0" width="256" height="256"/>
</svg>'''
    
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"Saved favicon.svg to {svg_path}")

    print("Success: Logo and PWA icons replacement completed successfully!")

if __name__ == '__main__':
    main()

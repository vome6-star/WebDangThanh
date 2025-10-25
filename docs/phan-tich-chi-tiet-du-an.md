# Phân Tích Chi Tiết Dự Án: Mine Tunnel Image Generator

## 1. Tổng Quan Dự Án

**Mine Tunnel Image Generator** là một ứng dụng web single-page (SPA) được xây dựng bằng React và TypeScript, cho phép người dùng tạo ra hình ảnh về hầm mỏ dựa trên mô tả văn bản. Ứng dụng tích hợp với Gemini API để thực hiện việc tạo ảnh và sử dụng một kho lưu trữ (repository) trên GitHub như một "backend" phi tập trung để quản lý thư viện ảnh tham khảo.

**Công nghệ chính sử dụng:**

-   **Frontend:** React, TypeScript, Tailwind CSS.
-   **API Trí tuệ nhân tạo:** Google Gemini API (`@google/genai`).
-   **"Backend" & Lưu trữ:** GitHub Repository (`ImageLibrary`).
-   **Môi trường:** Chạy hoàn toàn trên trình duyệt, không cần máy chủ backend chuyên dụng.

## 2. Cấu Trúc Thư Mục

Dự án được tổ chức một cách rõ ràng, tách biệt các thành phần giao diện, logic nghiệp vụ và các dịch vụ.

```
/
├── components/          # Các thành phần React tái sử dụng
│   ├── MainTab.tsx       # Giao diện chính cho việc tạo ảnh
│   └── SettingsTab.tsx   # Giao diện quản lý thư viện ảnh
│   └── ...
├── docs/                # Thư mục chứa tài liệu
│   └── phan-tich-chi-tiet-du-an.md (File này)
├── services/            # Các module xử lý logic nghiệp vụ
│   ├── geminiService.ts  # Tương tác với Gemini API
│   └── githubService.ts  # Tương tác với GitHub API
├── App.tsx              # Component gốc của ứng dụng
├── index.html           # File HTML đầu vào
├── index.tsx            # Điểm khởi tạo của React
└── metadata.json        # Siêu dữ liệu của ứng dụng
```

## 3. Luồng Hoạt Động Chính (Workflows)

### 3.1. Khởi tạo và Xác thực

1.  Khi ứng dụng tải lần đầu (`App.tsx`), nó sẽ gọi `getApiToken` từ `githubService.ts`.
2.  Hàm này lấy một phần của GitHub Personal Access Token (PAT) từ một repository công khai khác (`Info/DataAccess`).
3.  Token hoàn chỉnh được ghép lại và lưu vào state, cho phép ứng dụng thực hiện các lệnh gọi API tới repo `ImageLibrary`.
4.  Nếu quá trình lấy token thất bại, ứng dụng sẽ hiển thị thông báo lỗi.

### 3.2. Tạo ảnh (MainTab.tsx)

1.  Người dùng nhập mô tả (prompt).
2.  Người dùng có thể tùy chọn một ảnh tham khảo từ thư viện trên GitHub (được tải về từ `manifest.json`) hoặc tải lên một ảnh từ máy tính.
3.  Khi nhấn "Generate", `geminiService.ts` được gọi.
4.  Dựa vào việc có ảnh tham khảo hay không, dịch vụ sẽ gọi model `imagen-4.0-generate-001` (text-to-image) hoặc `gemini-2.5-flash-image` (image-to-image).
5.  Prompt được "tăng cường" với các từ khóa về chất lượng và các prompt tiêu cực để cải thiện kết quả.
6.  Hình ảnh trả về (dưới dạng base64) được hiển thị và lưu vào Local Storage của trình duyệt.

### 3.3. Quản lý Thư viện (SettingsTab.tsx)

1.  Người dùng có thể tạo các "album" mới.
2.  Người dùng kéo và thả tệp tin hoặc thư mục ảnh vào vùng upload.
3.  Ứng dụng xử lý các tệp tin, đổi tên chúng theo một quy chuẩn (`album-name_timestamp_original-name.ext`).
4.  `githubService.ts` được sử dụng để:
    a. Tải từng tệp ảnh lên thư mục tương ứng với album trong repo `ImageLibrary`.
    b. Tải về file `manifest.json` hiện tại và SHA của nó.
    c. Cập nhật đối tượng JSON trong bộ nhớ với đường dẫn của các ảnh mới.
    d. Tải file `manifest.json` đã cập nhật lên lại repository, sử dụng SHA để tránh xung đột.
5.  Giao diện được cập nhật để hiển thị trạng thái upload.

## 4. Kiến Trúc "Backend" trên GitHub

Ứng dụng sử dụng một repository GitHub (`ImageLibrary`) như một hệ thống lưu trữ tệp và cơ sở dữ liệu đơn giản.

### 4.1. Cấu trúc Repository `ImageLibrary`

Repository được tổ chức theo các album. Mỗi album là một thư mục ở cấp gốc.

```
ImageLibrary/
├── normal/              # Thư mục cho album 'normal'
│   └── normal_1678886400000_image1.jpg
│   └── ...
├── character-designs/   # Thư mục cho album 'character-designs'
│   └── character-designs_1678886400001_image2.png
│   └── ...
└── manifest.json        # File chỉ mục (index) của toàn bộ thư viện
```

### 4.2. File `manifest.json`

Đây là tệp tin "cơ sở dữ liệu" trung tâm, chứa một đối tượng JSON ánh xạ tên album tới một mảng các đối tượng ảnh.

-   **Mục đích:** Giúp ứng dụng nhanh chóng biết được tất cả các ảnh có sẵn mà không cần phải duyệt qua toàn bộ cây thư mục của repository mỗi lần tải trang.
-   **Cấu trúc:**

```json
{
  "albums": {
    "normal": [
      {
        "path": "normal/normal_1678886400000_image1.jpg",
        "createdAt": "2023-03-15T12:00:00.000Z"
      }
    ],
    "character-designs": [
      {
        "path": "character-designs/character-designs_1678886400001_image2.png",
        "createdAt": "2023-03-15T12:00:01.000Z"
      }
    ]
  }
}
```

-   **Lưu ý:** `path` được lưu là đường dẫn tương đối từ gốc của repository, không có tiền tố `/`. Điều này giúp đơn giản hóa việc truy xuất tệp.

## 5. Điểm Mạnh và Nhược Điểm

### 5.1. Điểm mạnh

-   **Chi phí bằng không:** Không cần hosting cho backend, tận dụng GitHub miễn phí.
-   **Triển khai đơn giản:** Chỉ cần triển khai frontend.
-   **Phi tập trung:** Dữ liệu (ảnh tham khảo) được quản lý qua Git, dễ dàng theo dõi lịch sử và sao lưu.

### 5.2. Nhược điểm

-   **Bảo mật Token:** Việc đặt một phần token vào repo công khai có rủi ro, mặc dù nó không hoàn chỉnh. Token này có quyền ghi vào repo `ImageLibrary`, cần được quản lý cẩn thận.
-   **Hiệu năng:** Việc gọi API GitHub cho mỗi lần upload và cập nhật manifest có thể chậm hơn so với backend truyền thống.
-   **Xung đột:** Nếu có hai người dùng upload cùng lúc, có thể xảy ra xung đột khi cập nhật `manifest.json`. Logic hiện tại (sử dụng SHA) giúp giảm thiểu điều này nhưng không loại bỏ hoàn toàn.
-   **Giới hạn API:** Phụ thuộc vào giới hạn tỷ lệ (rate limit) của GitHub API.Linkraw manifest.json : 
https://raw.githubusercontent.com/dangthanhktdhumg-eng/ImageLibrary/refs/heads/main/manifest.json
Linkraw : hình ảnh mẫu để lấy cấu trúc làm hình hiển thị thumb
https://raw.githubusercontent.com/dangthanhktdhumg-eng/ImageLibrary/refs/heads/main/normal/normal_1761377086071_may-khoan-tamrok.jpg

Repo public ko cần token trong raw
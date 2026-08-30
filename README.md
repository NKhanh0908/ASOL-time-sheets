# Bảng Chấm Công Nội Bộ

Web app gọn nhẹ để cả team chấm công hằng ngày (giờ vào/ra, onsite/remote/nghỉ) và
tự động tổng hợp giờ làm cuối tháng.

- Backend: Node.js + Express (không cần cài database ngoài)
- Dữ liệu lưu trong file `data/db.json` trên server
- Frontend: HTML/CSS/JS thuần, không cần build

## 1. Chạy thử trên máy cá nhân

```bash
cd timesheet-app
npm install
npm start
```

Mở trình duyệt: http://localhost:3000

## 2. Deploy lên server nội bộ (cách đơn giản nhất)

Copy cả thư mục `timesheet-app` lên server (VD: qua `scp` hoặc git), rồi:

```bash
cd timesheet-app
npm install
npm start
```

Mặc định chạy ở cổng 3000. Đổi cổng bằng biến môi trường:

```bash
PORT=8080 npm start
```

Để app luôn chạy nền (tự khởi động lại nếu crash), dùng **pm2**:

```bash
npm install -g pm2
pm2 start server.js --name timesheet
pm2 save
pm2 startup   # để tự chạy lại khi server reboot
```

Sau đó ai trong công ty cũng vào được qua: `http://<ip-server-noi-bo>:3000`

## 3. Deploy bằng Docker (nếu server có Docker)

```bash
docker build -t timesheet-app .
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --name timesheet timesheet-app
```

Cờ `-v $(pwd)/data:/app/data` giúp dữ liệu không bị mất khi container restart.

## 4. Cho cả team truy cập dễ hơn

- Nếu server nội bộ có domain/DNS riêng, có thể dùng **nginx** làm reverse proxy để
  truy cập qua `timesheet.congty.local` thay vì gõ IP:port.
- App hiện **không có đăng nhập/phân quyền** — ai vào được địa chỉ đó cũng chấm công
  và xem được hết. Nếu công ty cần giới hạn truy cập, có thể thêm xác thực đơn giản
  (Basic Auth qua nginx, hoặc VPN nội bộ) — nói mình biết nếu cần, mình sẽ bổ sung.

## Cấu trúc thư mục

```
timesheet-app/
├── server.js          # Backend Express + API
├── package.json
├── data/db.json        # Dữ liệu (tự tạo khi chạy lần đầu)
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```

## Sao lưu dữ liệu

Toàn bộ dữ liệu nằm trong 1 file: `data/db.json`. Backup định kỳ file này là đủ.

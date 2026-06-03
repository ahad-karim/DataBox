# DataBox API - Endpoint Paths for Hopscotch Testing

All endpoints are prefixed with `http://localhost:3000/api/v1`.

---

## 🔒 Authentication

### 1. Register a New User
* **Method**: `POST`
* **Path**: `/auth/register`
* **Headers**: 
  * `Content-Type`: `application/json`
* **Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "SecurePassword123!"
  }
  ```

### 2. Login
* **Method**: `POST`
* **Path**: `/auth/login`
* **Headers**: 
  * `Content-Type`: `application/json`
* **Body**:
  ```json
  {
    "email": "john@databox.io",
    "password": "demo1234"
  }
  ```
* **Response**: Returns `accessToken` (Bearer token) and `refreshToken`. Use the `accessToken` in the `Authorization` header for protected endpoints: `Authorization: Bearer <accessToken>`.

### 3. Get Current User Profile
* **Method**: `GET`
* **Path**: `/auth/me`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`

---

## 📊 Dashboard Metrics (Protected - requires Bearer Token)

### 4. Get KPI Snapshots
* **Method**: `GET`
* **Path**: `/dashboard/kpis`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`
* **Query Params (Optional)**:
  * `period`: `current` or `previous` (defaults to `current`)

### 5. Get Demand Timeseries
* **Method**: `GET`
* **Path**: `/dashboard/demand-forecast`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`

### 6. Get Channel Performance
* **Method**: `GET`
* **Path**: `/dashboard/channel-performance`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`

### 7. Get Regional Revenue
* **Method**: `GET`
* **Path**: `/dashboard/regional-revenue`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`

### 8. Get Performance Metrics
* **Method**: `GET`
* **Path**: `/dashboard/performance-metrics`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`

---

## 🗺️ Markets & Pipeline (Protected - requires Bearer Token)

### 9. Get Market Forecasts
* **Method**: `GET`
* **Path**: `/dashboard/market-forecasts`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`
* **Query Params (Optional)**:
  * `region`: Filter by region (e.g. `Europe`, `Asia Pacific`)

### 10. Get Top Markets (Sorted by demand descending)
* **Method**: `GET`
* **Path**: `/dashboard/market-forecasts/top`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`

### 11. Get Pipeline Sync Events
* **Method**: `GET`
* **Path**: `/dashboard/pipeline/events`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`

### 12. Trigger Pipeline Sync
* **Method**: `POST`
* **Path**: `/dashboard/pipeline/trigger`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`

---

## 📂 Raw Data & Export (Protected - requires Bearer Token)

### 13. Get Raw Transaction-Level Data
* **Method**: `GET`
* **Path**: `/dashboard/raw-data`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`
* **Query Params (Optional)**:
  * `page`: Page number (defaults to `1`)
  * `limit`: Items per page (defaults to `100000` to fetch full datasets for dashboard context)

### 14. Export Raw Data as CSV
* **Method**: `GET`
* **Path**: `/dashboard/raw-data/export`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`
* **Response**: A file download of type `text/csv`.

---

## 🤖 AI Features (Protected - requires Bearer Token)

### 15. Generate Business Insights
* **Method**: `POST`
* **Path**: `/ai/insights`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`
  * `Content-Type`: `application/json`
* **Body**:
  ```json
  {
    "context": "kpis",
    "data": {
      "totalRevenue": 284521,
      "activeProducts": 1847
    }
  }
  ```

### 16. Generate Demand Forecast (Gemini Integration)
* **Method**: `POST`
* **Path**: `/dashboard/demand-forecast/generate`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`
  * `Content-Type`: `application/json`
* **Body**:
  ```json
  {
    "horizonDays": 7,
    "includeSeasonality": false
  }
  ```

---

## 🔔 Notifications (Protected - requires Bearer Token)

### 17. Get Notifications
* **Method**: `GET`
* **Path**: `/notifications`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`

### 18. Mark Notification as Read
* **Method**: `PATCH`
* **Path**: `/notifications/:id/read` (Replace `:id` with actual UUID of the notification)
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`

---

## 📤 Data Uploading (Protected - requires Bearer Token)

### 19. Upload Sales/Demand Dataset
* **Method**: `POST`
* **Path**: `/data/upload`
* **Headers**:
  * `Authorization`: `Bearer <accessToken>`
  * `Content-Type`: `application/json` (If sending raw JSON payload)
* **Body**:
  ```json
  {
    "type": "sales",
    "data": [
      {
        "Date": "2026-05-01",
        "Product_ID": "PRD-MILK",
        "Product_Name": "Aarong Milk 1L",
        "Category": "Dairy",
        "Location": "Dhaka",
        "Sales_Channel": "Retail",
        "Units_Sold": 120,
        "Revenue_BDT": 14400,
        "Cost_Price": 90,
        "Current_Stock": 450,
        "Customer_Segment": "Consumer"
      }
    ]
  }
  ```
  *(Note: You can also upload a CSV file as `multipart/form-data` with key `file` and query parameter `type=sales` or `type=demand`)*

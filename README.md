# Bizanolytics API: AI-Powered Commerce Intelligence 🚀[cite: 1]

The Bizanolytics API is a robust backend architecture designed to transform messy, raw sales data from Small and Medium Enterprises (SMEs) into actionable business foresight[cite: 1]. Built to power an "AI Command Center," this system handles automated data imputation, dynamic demand forecasting, and complex spatial queries to drive predictive heatmaps and generative action cards[cite: 1].

## 🧠 Core Architecture & Key Features[cite: 1]

* **Automated Data Imputation:** Cleanses and synthesizes raw, fragmented sales data in real-time to ensure forecasting models have reliable inputs[cite: 1].
* **Geospatial Intelligence:** Utilizes PostGIS to handle spatial database routing, geofencing, and location-based data aggregation for real-time tracking and mapping[cite: 1].
* **Natural Language Processing Integration:** Structures complex data pipelines to seamlessly feed the frontend natural language search bar, translating user queries into direct database actions[cite: 1].
* **Predictive Demand Forecasting:** Calculates core KPIs and future demand metrics to dynamically populate frontend heatmaps and action cards[cite: 1].
* **Hackathon-Ready Demo Seeding:** Includes comprehensive database seeding scripts to instantly spin up a live demo environment with realistic mock data[cite: 1].

---

## 🛠 Tech Stack[cite: 1]

| Category | Technology |
| :--- | :--- |
| **Language** | TypeScript[cite: 1] |
| **Database** | PostgreSQL[cite: 1] |
| **Spatial Extension** | PostGIS[cite: 1] |
| **API Architecture** | RESTful[cite: 1] |

*(Placeholder: Insert a link to your system architecture diagram here using Eraser.io or Excalidraw)*[cite: 1]

---

## 📡 API Reference Matrix[cite: 1]

Below are the core RESTful routes exposed by the Bizanolytics API[cite: 1].

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/forecast/heatmaps` | `GET` | Retrieves spatial data coordinates and intensity values for frontend heatmaps[cite: 1]. |
| `/api/v1/data/impute` | `POST` | Uploads raw sales data for automated cleansing and synthesis[cite: 1]. |
| `/api/v1/search/query` | `POST` | Processes natural language search inputs and returns structured business insights[cite: 1]. |
| `/api/v1/analytics/kpi` | `GET` | Fetches aggregated Key Performance Indicators for the main dashboard[cite: 1]. |

---

## 💻 Request & Response Example[cite: 1]

**`GET /api/v1/forecast/heatmaps`**[cite: 1]

**Response:**[cite: 1]
```json
{
  "status": "success",
  "data": {
    "region": "Dhaka_Central",
    "timestamp": "2026-07-01T10:00:00Z",
    "forecast": [
      {
        "coordinates": [90.4125, 23.8103],
        "demand_index": 87.5,
        "action_card_trigger": "High Volume Expected"
      },
      {
        "coordinates": [90.4200, 23.8000],
        "demand_index": 45.2,
        "action_card_trigger": "Monitor Inventory"
      }
    ]
  }
}
```

---

## 🚀 Getting Started[cite: 1]

Follow these steps to set up the development environment locally[cite: 1].

### 1. Clone the Repository[cite: 1]
```bash
git clone [https://github.com/YourUsername/Bizanolytics.git](https://github.com/YourUsername/Bizanolytics.git)
cd Bizanolytics
```

### 2. Environment Variables[cite: 1]
Create a `.env` file in the root directory[cite: 1]. Use the provided `.env.example` file as a reference for the required connection strings and API keys[cite: 1].
```bash
cp .env.example .env
```

### 3. Install Dependencies[cite: 1]
```bash
npm install
```

### 4. Database Setup & Seeding[cite: 1]
Initialize the PostGIS database and run the seeding script to populate the development environment with synthesized data[cite: 1].
```bash
npm run db:setup
npm run db:seed
```

### 5. Start the Server[cite: 1]
```bash
npm run dev
```

---

**Note to Recruiters/Developers:** A Postman collection for this API is included in the `/docs` folder for frictionless endpoint testing[cite: 1].

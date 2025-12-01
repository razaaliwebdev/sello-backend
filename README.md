# SELLO API – Live Endpoint Usage Guide

Welcome! This guide shows you how to use the **live SELLO API** for user authentication, car listing, and browsing. All examples use the deployed API at:

**Base URL:** [`https://sello-backend.onrender.com/api`](https://sello-backend.onrender.com/api)

---

## Quick Reference

- [User Endpoints](#user-endpoints)
- [Car Endpoints](#car-endpoints)
- [Authentication & Tokens](#authentication--tokens)
- [Example Requests](#example-requests)
- [Error Responses](#error-responses)

---

## Authentication & Tokens

- **Login** or **Google Login** to receive a JWT token (in a cookie or as a response field).
- For protected endpoints, send the token:
  - As a cookie named `token` (automatic if using browser)
  - Or in the `Authorization` header: `Bearer <token>`

---

## User Endpoints

### Register

- **POST** `/api/auth/register`
- **Form Data:**
  - `name` (string, required)
  - `email` (string, required)
  - `password` (string, required)
  - `role` (string, optional: `buyer` or `seller`)
  - `avatar` (file, required)
- **Returns:** User info (no password)

### Login

- **POST** `/api/auth/login`
- **JSON Body:** `{ "email": "...", "password": "..." }`
- **Returns:** User info, sets JWT cookie

### Forgot Password

- **POST** `/api/auth/forgot-password`
- **JSON Body:** `{ "email": "..." }`
- **Returns:** Message about OTP sent

### Verify OTP

- **POST** `/api/auth/verify-otp`
- **JSON Body:** `{ "otp": "..." }`
- **Header:** `email: user@example.com`
- **Returns:** Message about OTP verification

### Reset Password

- **POST** `/api/auth/reset-password`
- **JSON Body:** `{ "newPassword": "..." }`
- **Header:** `email: user@example.com`
- **Returns:** Message about password update

### Google Login

- **POST** `/api/auth/google`
- **JSON Body:** `{ "token": "<Google ID token>" }`
- **Returns:** JWT token

### Get User Profile

- **GET** `/api/auth/me`
- **Auth:** JWT required
- **Returns:** User profile (no password)

---

## Car Endpoints

### Get All Cars

- **GET** `/api/cars/`
- **Returns:** List of all cars

### Get Single Car

- **GET** `/api/cars/:id`
- **Returns:** Car details

### Get Filtered Cars

- **GET** `/api/cars/filter?make=Toyota&year=2020&price=15000`
- **Returns:** Filtered list of cars

### Create Car

- **POST** `/api/cars/`
- **Auth:** JWT required (seller)
- **Form Data:**
  - All car fields (see below)
  - `images` (file[], required, up to 8)
- **Returns:** Created car object

### Edit Car

- **PUT** `/api/cars/:id`
- **Auth:** JWT required (owner or admin)
- **JSON Body:** Any car field(s) to update
- **Returns:** Updated car object

### Delete Car

- **DELETE** `/api/cars/:id`
- **Auth:** JWT required (owner or admin)
- **Returns:** Message about deletion

### Get My Listings

- **GET** `/api/cars/my/listings`
- **Auth:** JWT required
- **Returns:** List of your cars

---

## Example Requests

### Register User (cURL)

```bash
curl -X POST "https://sello-backend.onrender.com/api/auth/register" \
  -F "name=John Doe" \
  -F "email=john@example.com" \
  -F "password=yourpassword" \
  -F "avatar=@/path/to/avatar.jpg"
```

### Login (cURL)

```bash
curl -X POST "https://sello-backend.onrender.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"yourpassword"}'
```

### Create Car Listing (cURL)

```bash
curl -X POST "https://sello-backend.onrender.com/api/cars/" \
  -H "Authorization: Bearer <token>" \
  -F "make=Toyota" \
  -F "model=Corolla" \
  -F "year=2020" \
  -F "condition=used" \
  -F "price=15000" \
  -F "city=New York" \
  -F "contactNumber=1234567890" \
  -F "images=@/path/to/car1.jpg" \
  -F "images=@/path/to/car2.jpg"
```

### Get All Cars (cURL)

```bash
curl "https://sello-backend.onrender.com/api/cars/"
```

---

## Data Model (Reference)

### User

| Field         | Type    | Description                |
| ------------- | ------- | -------------------------- |
| \_id          | String  | Unique user ID             |
| name          | String  | User's name                |
| email         | String  | User's email               |
| avatar        | String  | Avatar image URL           |
| role          | String  | 'buyer' or 'seller'        |
| verified      | Boolean | Email/Google verified      |
| carsPosted    | Array   | Cars listed by the user    |
| carsPurchased | Array   | Cars purchased by the user |
| createdAt     | Date    | Registration date          |

### Car

| Field         | Type   | Description               |
| ------------- | ------ | ------------------------- |
| \_id          | String | Unique car ID             |
| images        | Array  | Array of image URLs       |
| make          | String | Car make (e.g., Toyota)   |
| model         | String | Car model (e.g., Corolla) |
| year          | Number | Year of manufacture       |
| condition     | String | 'new' or 'used'           |
| price         | Number | Price in USD              |
| city          | String | City where car is located |
| contactNumber | String | Seller's contact number   |
| postedBy      | String | User ID of the seller     |
| ...           | ...    | Other optional fields     |

---

## Error Responses

All errors are JSON with a `message` field. Common status codes:

- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

**Example:**

```json
{
  "message": "Invalid email or password"
}
```

---

---

## Email Configuration (SMTP)

To enable OTP and email notifications, configure SMTP settings in your `.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_MAIL=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Gmail Setup:
1. Enable 2-Step Verification in your Google Account
2. Go to Google Account > Security > App passwords
3. Generate an app password for "Mail"
4. Use this app password as `SMTP_PASSWORD` (not your regular password)

### Development Mode:
If SMTP is not configured in development mode, OTPs will be logged to the server console instead of being sent via email. Check your server logs for the OTP code.

### Other SMTP Providers:
- **Outlook/Hotmail**: `smtp-mail.outlook.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`
- **Custom SMTP**: Use your provider's SMTP settings

---

**For any issues, contact the maintainer or open an issue.**

# Cable & Internet Billing System

A full-stack web application for managing cable and internet customers, packages, payments, billing, balances, locations, and customer status.

The application provides a responsive dashboard for managing customers and payments, with a React/Vite frontend, Node.js/Express backend, and MongoDB database.

It is also configured as a Progressive Web App (PWA), allowing the application to be installed and used like a native application on supported devices.

---

## 🚀 Features

### Customer Management

- Add new customers
- Edit customer information
- View complete customer details
- Search customers
- Filter customers
- Customer code and NUID management
- Mobile number management
- Location management
- Package management
- Customer status management
- Active / Inactive / Free / DC status tracking
- Customer status history

### Billing & Payments

- Monthly package billing
- Add customer payments
- Track current-month payments
- Calculate outstanding balances
- Carry forward unpaid balances
- Monthly balance breakdown
- Payment history
- Balance management
- Billing start month and year
- Package amount tracking

### Customer Status

Customers can have different statuses:

- `ACTIVE`
- `INACTIVE`
- `FREE`
- `DC`

Status history can be maintained month-by-month.

Example:

```json
{
  "month": 7,
  "year": 2026,
  "status": "free"
}
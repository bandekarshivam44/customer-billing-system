# EEJAK Technologies

> Modern digital solutions for businesses, startups, and organisations worldwide.

EEJAK Technologies is a modern technology company portfolio website built to showcase the company's services, projects, capabilities, and provide a way for potential clients to get in touch or submit project enquiries.

The website is designed with a clean, modern, responsive interface and is built using Next.js and Tailwind CSS.

---

## 🚀 About EEJAK Technologies

EEJAK Technologies builds modern digital solutions including:

- Custom Web Applications
- Mobile Applications
- SaaS Products
- Business Software
- Custom Digital Platforms
- Website Development
- API & Backend Development
- Business Automation
- Custom Software Solutions

> We build powerful digital solutions—from custom mobile apps and web platforms to SaaS products and business software—that help organisations grow, scale, and succeed worldwide.

---

# ✨ Features

- Modern responsive design
- Mobile-friendly navigation
- Clean company presentation
- About page
- Services page
- Project enquiry page
- Contact page
- Custom 404 page
- Responsive footer
- Company logo integration
- Client-side navigation using Next.js
- Reusable components
- Tailwind CSS styling

---

# 🧭 Website Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Company introduction and main services |
| About | `/about` | Information about EEJAK Technologies |
| Services | `/services` | Services offered by the company |
| Project Enquiry | `/project-enquiry` | Client project enquiry page |
| Contact | `/contact` | Company contact information |
| 404 | Any invalid route | Custom page-not-found screen |

---

# 🛠️ Tech Stack

## Frontend

- Next.js 16
- React
- Tailwind CSS
- JavaScript
- HTML5
- CSS3

## Backend

The project can be extended with a Node.js/Express backend for:

- Project enquiries
- Contact submissions
- Email notifications
- Admin functionality
- Database operations
- API endpoints

## Database

MongoDB / MongoDB Atlas can be used for:

- Project enquiries
- Contact submissions
- Client information
- Project information

---

# 📁 Project Structure

```text
eejak-main/
│
├── frontend/
│   ├── app/
│   │   ├── about/
│   │   │   └── page.js
│   │   ├── contact/
│   │   │   └── page.js
│   │   ├── project-enquiry/
│   │   │   └── page.js
│   │   ├── services/
│   │   │   └── page.js
│   │   ├── globals.css
│   │   ├── layout.js
│   │   ├── not-found.js
│   │   └── page.js
│   │
│   ├── components/
│   │   ├── navbar.js
│   │   └── footer.js
│   │
│   ├── public/
│   │   └── logo.png
│   │
│   ├── package.json
│   ├── postcss.config.mjs
│   └── ...
│
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── server.js
│   ├── package.json
│   └── ...
│
├── .gitignore
└── README.md
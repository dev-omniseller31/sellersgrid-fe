from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    Preformatted, KeepTogether
)
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.colors import HexColor

OUT = "output/pdf/vps-web-app-deployment-guide.pdf"

NAVY = HexColor("#17324D")
BLUE = HexColor("#2563A6")
PALE = HexColor("#EEF5FB")
INK = HexColor("#1F2933")
MUTED = HexColor("#586775")
GREEN = HexColor("#EAF6EE")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontSize=28, leading=34, textColor=NAVY, alignment=TA_CENTER, spaceAfter=16))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["Normal"], fontSize=13, leading=20, textColor=MUTED, alignment=TA_CENTER, spaceAfter=26))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontSize=18, leading=22, textColor=NAVY, spaceBefore=16, spaceAfter=9, keepWithNext=True))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontSize=12.5, leading=16, textColor=BLUE, spaceBefore=11, spaceAfter=5, keepWithNext=True))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontSize=9.5, leading=14, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontSize=8.3, leading=11, textColor=MUTED, spaceAfter=5))
styles.add(ParagraphStyle(name="Codex", fontName="Courier", fontSize=7.5, leading=10, textColor=HexColor("#1F2933"), backColor=HexColor("#F3F6F8"), borderColor=HexColor("#D7E0E8"), borderWidth=0.5, borderPadding=8, leftIndent=0, rightIndent=0, spaceBefore=4, spaceAfter=8))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontSize=9, leading=13, textColor=INK, backColor=PALE, borderColor=HexColor("#B9D5ED"), borderWidth=0.5, borderPadding=8, spaceBefore=5, spaceAfter=9))

def P(text, style="Bodyx"):
    return Paragraph(text, styles[style])

def code(text):
    return Preformatted(text.strip("\n"), styles["Codex"])

def bullets(items):
    return [P("• " + item, "Bodyx") for item in items]

def header_footer(canvas, doc):
    canvas.saveState()
    w, h = letter
    if doc.page > 1:
        canvas.setStrokeColor(HexColor("#D7E0E8"))
        canvas.line(0.65*inch, h-0.48*inch, w-0.65*inch, h-0.48*inch)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(NAVY)
        canvas.drawString(0.65*inch, h-0.36*inch, "VPS Web App Deployment Guide")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(w-0.65*inch, 0.38*inch, f"Page {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(OUT, pagesize=letter, rightMargin=0.65*inch, leftMargin=0.65*inch, topMargin=0.7*inch, bottomMargin=0.62*inch, title="Beginner-Friendly VPS Web App Deployment Guide", author="OpenAI")
story = []

story += [Spacer(1, 1.0*inch), P("Deploy Any Web App on a VPS", "CoverTitle"), P("A practical beginner guide for Node.js, PostgreSQL, PM2, Nginx, DNS, and HTTPS", "CoverSub")]
story.append(Table([[P("Frontend", "Smallx"), P("Backend", "Smallx"), P("Database", "Smallx"), P("HTTPS", "Smallx")], [P("Next.js / React", "Bodyx"), P("Node.js / NestJS", "Bodyx"), P("PostgreSQL", "Bodyx"), P("Let's Encrypt", "Bodyx")]], colWidths=[1.65*inch]*4, style=[("BACKGROUND", (0,0), (-1,0), PALE), ("BOX", (0,0), (-1,-1), 0.5, HexColor("#B9D5ED")), ("INNERGRID", (0,0), (-1,-1), 0.35, HexColor("#D7E0E8")), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("LEFTPADDING", (0,0), (-1,-1), 8), ("RIGHTPADDING", (0,0), (-1,-1), 8)]))
story += [Spacer(1, 0.35*inch), P("The goal", "H2x"), P("By the end, your application will be available through a domain name, run continuously after reboots, use HTTPS, and connect securely to PostgreSQL.", "Bodyx"), Spacer(1, 0.5*inch), P("Example domains", "H2x"), P("example.com → frontend &nbsp;&nbsp;|&nbsp;&nbsp; api.example.com → backend", "Bodyx"), PageBreak()]

story += [P("1. How the deployment works", "H1x"), P("Your browser talks to Nginx. Nginx forwards frontend requests to the web application and API requests to the backend. The backend talks to PostgreSQL over the private server network.", "Bodyx")]
story.append(Table([[P("Browser", "Bodyx"), P("→", "H2x"), P("Nginx", "Bodyx"), P("→", "H2x"), P("Frontend / Backend", "Bodyx"), P("→", "H2x"), P("PostgreSQL", "Bodyx")]], colWidths=[0.95*inch,0.25*inch,0.85*inch,0.25*inch,1.5*inch,0.25*inch,1.1*inch], style=[("BACKGROUND", (0,0), (-1,-1), PALE), ("BOX", (0,0), (-1,-1), 0.5, HexColor("#B9D5ED")), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("ALIGN", (1,0), (1,0), "CENTER"), ("ALIGN", (3,0), (3,0), "CENTER"), ("ALIGN", (5,0), (5,0), "CENTER")]))
story += [P("2. Before you start", "H1x"), P("You need a VPS with Ubuntu/Debian, its public IP address, a domain name, your source repository, database backup (if applicable), and the environment variables required by the app.", "Bodyx"), P("Keep these values ready: database name/user/password, JWT or session secret, SMTP credentials, frontend API URL, and any payment or OAuth keys.", "Callout")]

story += [P("3. Prepare the VPS", "H1x"), P("Connect over SSH and update the server:", "Bodyx"), code("ssh root@YOUR_VPS_IP\napt update && apt upgrade -y\napt install -y git curl nginx ufw unzip")]
story += [P("Create a normal deployment user, then use that user for application work:", "Bodyx"), code("adduser deploy\nusermod -aG sudo deploy\nssh deploy@YOUR_VPS_IP")]
story += [P("Enable only the required public services:", "Bodyx"), code("sudo ufw allow OpenSSH\nsudo ufw allow 'Nginx Full'\nsudo ufw enable\nsudo ufw status"), P("Do not expose PostgreSQL port 5432 to the internet unless you deliberately need remote database access.", "Callout")]

story += [P("4. Install Node.js and PostgreSQL", "H1x"), P("Use the Node.js version required by the project. The example below installs Node.js 20:", "Bodyx"), code("curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\nsudo apt install -y nodejs\nnode --version\nnpm --version"), P("Install PostgreSQL:", "Bodyx"), code("sudo apt install -y postgresql postgresql-contrib\nsudo systemctl enable --now postgresql")]

story += [P("5. Create or restore the database", "H1x"), P("Use a dedicated application user instead of the PostgreSQL superuser:", "Bodyx"), code("sudo -u postgres psql"), code("CREATE USER app_user WITH PASSWORD 'USE_A_LONG_RANDOM_PASSWORD';\nCREATE DATABASE app_database OWNER app_user;\n\\q")]
story += [P("For a plain SQL backup:", "Bodyx"), code("psql -h 127.0.0.1 -U app_user -d app_database -f /path/to/backup.sql"), P("Verify that tables and data exist:", "Bodyx"), code("sudo -u postgres psql -d app_database\n\\dt\nSELECT COUNT(*) FROM users;\n\\q")]

story += [PageBreak(), P("6. Download the application", "H1x"), code("sudo mkdir -p /var/www\nsudo chown deploy:deploy /var/www\ncd /var/www\ngit clone git@github.com:YOUR_USERNAME/YOUR_REPOSITORY.git myapp\ncd myapp\nfind . -name package.json")]
story += [P("SSH deploy keys are preferable for private repositories. If you temporarily use a GitHub Personal Access Token, never leave it in shell history, scripts, or documentation. Revoke an exposed token immediately.", "Callout")]
story += [P("7. Configure and build the backend", "H1x"), code("cd /var/www/myapp/backend\ncp .env.example .env\nnano .env")]
story += [P("Example environment values:", "Bodyx"), code("NODE_ENV=production\nPORT=4000\nDATABASE_HOST=127.0.0.1\nDATABASE_PORT=5432\nDATABASE_USER=app_user\nDATABASE_PASSWORD=USE_A_LONG_RANDOM_PASSWORD\nDATABASE_NAME=app_database\nJWT_SECRET=USE_A_LONG_RANDOM_SECRET\nCORS_ORIGIN=https://example.com"), P("The variable names must match the code. Protect the file:", "Bodyx"), code("chmod 600 .env\nnpm ci\nnpm run build\nls dist")]
story += [P("Test locally before adding Nginx:", "Bodyx"), code("npm run start:prod\n# From another SSH session:\ncurl http://127.0.0.1:4000/api/health"), P("Stop the temporary process with Ctrl+C. If PostgreSQL authentication fails, compare the credentials in .env with the database user you created.", "Callout")]

story += [P("8. Keep the backend running with PM2", "H1x"), code("sudo npm install -g pm2\ncd /var/www/myapp/backend\npm2 start dist/main.js --name myapp-api\npm2 status\npm2 logs myapp-api\npm2 save\npm2 startup"), P("PM2 prints a startup command. Run the exact command it provides, then run pm2 save again.", "Smallx")]
story += [P("9. Point your domain to the VPS", "H1x"), P("Create these DNS A records at your domain provider:", "Bodyx")]
story.append(Table([[P("Type", "Bodyx"), P("Name", "Bodyx"), P("Value", "Bodyx")], [P("A", "Bodyx"), P("@", "Bodyx"), P("VPS public IP", "Bodyx")], [P("A", "Bodyx"), P("www", "Bodyx"), P("VPS public IP", "Bodyx")], [P("A", "Bodyx"), P("api", "Bodyx"), P("VPS public IP", "Bodyx")]], colWidths=[0.8*inch,1.0*inch,3.5*inch], style=[("BACKGROUND", (0,0), (-1,0), PALE), ("GRID", (0,0), (-1,-1), 0.4, HexColor("#B9D5ED")), ("LEFTPADDING", (0,0), (-1,-1), 7), ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6)]))
story += [P("Check DNS after it propagates:", "Bodyx"), code("dig api.example.com\nping api.example.com")]

story += [PageBreak(), P("10. Configure Nginx for the API", "H1x"), code("sudo nano /etc/nginx/sites-available/myapp-api"), P("Use this configuration, changing the domain and port if needed:", "Bodyx"), code("server {\n    listen 80;\n    server_name api.example.com;\n\n    location / {\n        proxy_pass http://127.0.0.1:4000;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection \"upgrade\";\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}"), code("sudo ln -s /etc/nginx/sites-available/myapp-api /etc/nginx/sites-enabled/myapp-api\nsudo nginx -t\nsudo systemctl reload nginx\ncurl http://api.example.com/api/health")]
story += [P("A 502 Bad Gateway usually means the backend is stopped or Nginx is forwarding to the wrong port:", "Bodyx"), code("pm2 status\npm2 logs myapp-api\nsudo tail -f /var/log/nginx/error.log")]
story += [P("11. Enable HTTPS", "H1x"), code("sudo apt install -y certbot python3-certbot-nginx\nsudo certbot --nginx -d api.example.com\nsudo certbot renew --dry-run")]
story += [P("12. Deploy the frontend", "H1x"), P("If the frontend runs on the same VPS:", "Bodyx"), code("cd /var/www/myapp/frontend\ncp .env.example .env.production\nnano .env.production"), P("For a Next.js frontend, the API variable might be:", "Bodyx"), code("NEXT_PUBLIC_BACKEND_URL=https://api.example.com/api"), P("Search the code to confirm the real variable name:", "Bodyx"), code("rg \"NEXT_PUBLIC|localhost:4000|BACKEND_URL|API_URL\" ."), code("npm ci\nnpm run build\npm2 start npm --name myapp-web -- start\npm2 save")]
story += [P("Configure the frontend domain in Nginx:", "Bodyx"), code("sudo nano /etc/nginx/sites-available/myapp-web"), code("server {\n    listen 80;\n    server_name example.com www.example.com;\n\n    location / {\n        proxy_pass http://127.0.0.1:3000;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection \"upgrade\";\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}"), code("sudo ln -s /etc/nginx/sites-available/myapp-web /etc/nginx/sites-enabled/myapp-web\nsudo nginx -t\nsudo systemctl reload nginx\nsudo certbot --nginx -d example.com -d www.example.com")]
story += [P("If the frontend is hosted on Hostinger, Vercel, or another provider, set NEXT_PUBLIC_BACKEND_URL there and perform a fresh build. NEXT_PUBLIC variables are commonly embedded during the frontend build, so changing the variable without rebuilding may have no effect.", "Callout")]

story += [PageBreak(), P("13. Verify the complete deployment", "H1x"), P("Test the API:", "Bodyx"), code("curl https://api.example.com/api/health"), P("Open the frontend:", "Bodyx"), code("https://example.com"), P("In browser developer tools, API requests should use https://api.example.com/api/... and never http://localhost:4000. Test login, registration, and the main data pages.", "Bodyx")]
story += [P("14. Update the application", "H1x"), code("cd /var/www/myapp\ngit pull\ncd backend\nnpm ci\nnpm run build\npm2 restart myapp-api\ncd ../frontend\nnpm ci\nnpm run build\npm2 restart myapp-web"), P("If your project uses database migrations, follow its documented migration process before restarting the backend. Do not run unknown migrations blindly in production.", "Callout")]
story += [P("15. Troubleshooting map", "H1x")]
trouble = [[P("Symptom", "Bodyx"), P("First checks", "Bodyx")], [P("Database login fails", "Bodyx"), P(".env credentials, database name, user, password, PostgreSQL status", "Bodyx")], [P("502 Bad Gateway", "Bodyx"), P("pm2 status, backend port, Nginx proxy_pass, PM2 logs", "Bodyx")], [P("Domain fails", "Bodyx"), P("DNS A record, firewall, Nginx test, domain spelling", "Bodyx")], [P("Frontend calls localhost", "Bodyx"), P("Variable name, fresh frontend build, browser cache, hardcoded fallback", "Bodyx")], [P("CORS error", "Bodyx"), P("Backend CORS origin matches the exact HTTPS frontend URL", "Bodyx")]]
story.append(Table(trouble, colWidths=[1.55*inch,4.0*inch], style=[("BACKGROUND", (0,0), (-1,0), PALE), ("GRID", (0,0), (-1,-1), 0.4, HexColor("#B9D5ED")), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 7), ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6)]))

story += [P("Production checklist", "H1x")]
checklist = ["SSH keys configured; root login disabled after testing", "Firewall enabled; only SSH, HTTP, and HTTPS exposed", "Dedicated PostgreSQL user created; port 5432 private", "Secrets protected and excluded from Git", "Database backup restored and verified", "PM2 startup tested after reboot", "DNS records resolve to the VPS", "Nginx configuration passes nginx -t", "HTTPS certificate installed and renewal tested", "Frontend rebuilt after changing public environment variables", "Login and critical API routes tested", "Backups, uptime alerts, and log monitoring configured", "Any exposed GitHub token revoked"]
story += bullets([f"☐ {x}" for x in checklist])
story += [Spacer(1, 8), P("Key lesson", "H2x"), P("Most deployment failures are configuration mismatches: wrong database credentials, wrong environment-variable names, missing rebuilds, incorrect ports, DNS pointing elsewhere, or frontend code still using localhost.", "Callout")]

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUT)

from pathlib import Path
from html import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.enums import TA_LEFT

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/MarketFlow-Vercel-Neon-Beginners-Guide.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
W, H = 595.28, 841.89
PURPLE, GOLD, INK, MUTED = map(HexColor, ['#5B2A86','#D4AF37','#192333','#536175'])
c = canvas.Canvas(str(OUT), pagesize=(W,H))
c.setTitle('MarketFlow | Vercel and Neon Deployment Guide')
c.setAuthor('MarketFlow project documentation')
body = ParagraphStyle('body', fontName='Helvetica', fontSize=10.5, leading=15, textColor=INK)
small = ParagraphStyle('small', parent=body, fontSize=9, leading=12)
head = ParagraphStyle('head', parent=body, fontName='Helvetica-Bold', fontSize=13, leading=18, textColor=PURPLE)
y = 0
page = 0

def start(kicker, title, subtitle=''):
    global y, page
    if page: c.showPage()
    page += 1
    c.setFillColor(HexColor('#F8FAFC')); c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(PURPLE); c.rect(0,H-10,W,10,fill=1,stroke=0)
    c.setFont('Helvetica-Bold',9); c.drawString(44,H-39,'MARKETFLOW / DEPLOYMENT HANDBOOK')
    c.setFillColor(GOLD); c.setFont('Helvetica-Bold',10); c.drawString(44,H-76,kicker.upper())
    c.setFillColor(INK); c.setFont('Helvetica-Bold',25); c.drawString(44,H-112,title)
    y=H-139
    if subtitle: p(subtitle)
    c.setStrokeColor(HexColor('#DCE1E8')); c.line(44, forty:=40,W-44,forty)
    c.setFillColor(MUTED); c.setFont('Helvetica',8)
    c.drawString(44,26,'Testing edition | 14 September 2026 | Repository: SAAS')
    c.drawRightString(W-44,26,f'{page:02d}')

def p(text, style=body, gap=10):
    global y
    q=Paragraph(text,style); _,h=q.wrap(W-88,y-58)
    if y-h < 57: raise ValueError(f'Page {page} overflow: {text[:65]}')
    q.drawOn(c,44,y-h); y-=h+gap

def h(text): p(text,head,7)
def step(n,title,text): h(f'{n}. {title}'); p(text)
def code(text):
    global y
    lines=text.strip().splitlines(); height=14*len(lines)+18
    if y-height < 57: raise ValueError(f'Code overflow page {page}')
    c.setFillColor(HexColor('#EEE8F4')); c.roundRect(44,y-height,W-88,height,5,fill=1,stroke=0)
    c.setFillColor(INK); c.setFont('Courier',8.3)
    for i,line in enumerate(lines):
        if c.stringWidth(line,'Courier',8.3)>W-112: raise ValueError('Code line too wide: '+line)
        c.drawString(56,y-18-i*14,line)
    y-=height+12
def table(rows,widths):
    global y
    cells=[[Paragraph(escape(str(v)),small) for v in row] for row in rows]
    t=Table(cells,colWidths=widths)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor('#E6DCEE')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,0),(-1,-1),.5,HexColor('#DCE1E8'))]))
    _,height=t.wrap(W-88,y)
    if y-height<57: raise ValueError(f'Table overflow page {page}')
    t.drawOn(c,44,y-height); y-=height+14
def note(text): p('<b>Checkpoint:</b> '+text)

start('From your laptop to a live test site','Deploy MarketFlow','A beginner-friendly guide to your Next.js frontend, NestJS backend and Neon PostgreSQL database on Vercel.')
p('One repository. Two Vercel projects. One connected database.',head)
p('Follow this guide in order if you are starting fresh. If your projects already exist, compare their settings with the tables before creating anything new.')
table([['Your current test setup','Purpose'],['saas-web-virid.vercel.app','Frontend: pages, login and dashboard'],['saas-api-xi.vercel.app','Backend: authentication and application API'],['neon-crimson-cushion','Neon PostgreSQL resource connected to saas-api']], [245,262])
h('What this guide does and does not promise')
p('The routing and allowed-origin fixes were deployed and checked in this session. Login reached the authentication handler and returned <b>Invalid email or password</b> for the suggested demo account. A successful owner login, marketplace publication and durable image storage have not been verified.')
p('This is a testing deployment guide, not a claim that every feature is production-ready. The final chapters explain the remaining storage, queue and marketplace work. No real passwords, tokens or database connection strings are printed here.')
h('Free-plan boundary')
p('Vercel Hobby is intended for personal, non-commercial use. Treat this as a personal learning/test deployment only when it meets those terms. A commercial SaaS needs a suitable plan. Neon and Queues also have usage limits; check current pricing before enabling workloads. [S1, S7]')
p('Prepared from the checked-in source, observed Vercel configuration and official documentation. Baseline routing fix: <b>f2a6902</b>. The PDF does not modify your application.',small)

start('01 / Understand the system','What runs where')
table([['Component','Actual implementation','Where it runs'],['Frontend','Next.js 16.3.4 + React 19.2.4 + TypeScript; custom CSS','Vercel project: saas-web'],['Backend','NestJS 11 + Prisma 6 + PostgreSQL models','Vercel project: saas-api'],['Database','Neon managed PostgreSQL','Neon, connected through Vercel'],['Publishing','@vercel/queue send + callback consumer','Vercel Queue and function'],['Images','Current code writes files to ./storage','Not durable on Vercel']], [90,237,180])
code('Browser\n  -> Frontend /api/auth/login\n  -> Next.js rewrite to backend /api/auth/login\n  -> Vercel routes to /index/api/auth/login\n  -> Nest normalizes to /api/auth/login\n  -> Prisma reads Neon\n  -> Response + session cookie -> Browser')
h('Five terms you will see')
p('<b>Repository:</b> your project files in GitHub. <b>Build:</b> compiling source into deployable output. <b>Deployment:</b> one built version of your site. <b>Environment variable:</b> a setting supplied outside the code. <b>Migration:</b> a saved SQL change that creates or updates database tables.')
p('The database is managed by Neon, not inside a Next.js page or Docker container on Vercel. Docker is useful locally; you do not start Docker, npm run dev or a permanent worker on Vercel.')
note('The README still mentions Redis/BullMQ and has older claims about security. For this guide, current source code takes priority. Do not install Redis just to deploy the present Vercel queue path.')

start('02 / Find your files','Repository map')
code('SAAS/                         <- frontend project root\n  app/login/page.tsx           <- login + registration\n  app/dashboard/               <- private dashboard\n  app/api.ts                   <- browser API helper\n  next.config.ts               <- frontend API rewrite\n  proxy.ts                     <- frontend security headers\n  package.json                 <- npm workspaces + scripts\n  apps/api/                    <- backend project root\n    src/main.ts                <- Nest startup + origin check\n    src/routing.ts             <- /index prefix normalization\n    src/app.service.ts         <- application operations\n    src/connectors.ts          <- marketplace integrations\n    prisma/schema.prisma       <- database model\n    prisma/migrations/         <- checked-in SQL migrations\n    scripts/migrate.cjs        <- deploy migration runner\n    api/queues/marketplace-publishing.ts\n    vercel.json                <- API + queue routing')
h('The most common setup mistake')
p('There is <b>no apps/web folder</b> in this repository. Import the same GitHub repository twice: the frontend uses the repository root; the backend uses <b>apps/api</b>. Vercel monorepos support a separate project per application. [S2]')
h('Database relationships')
p('A User has Membership records. Each Membership connects a user to an Organization and carries the OWNER, ADMIN, STAFF or VIEWER role. Products, stores, orders and publishing jobs belong to an organization. Listings connect products to stores.')
note('The role is in <b>Membership</b>, not User. Local PostgreSQL data does not appear in Neon automatically. Deploying code also does not copy your local owner account.')

start('03 / Preparation','Before you click Deploy')
step('1','Prepare your accounts','Sign in to GitHub and Vercel. Use the Vercel account/team where you want both projects. Enable two-factor authentication and keep recovery access available. Neon data access may ask you to verify your identity again.')
step('2','Install the local tools','Use Git and Node.js 24.x for consistency with the observed deployment. Node includes npm. Open PowerShell in your project directory; use the commands below one line at a time.')
code('cd C:\\Users\\Asus\\Downloads\\SaaS\nnode --version\nnpm --version\ngit status\nnpm ci\nnpm test\nnpm run lint\nnpm run build\nnpm exec --workspace @marketflow/api -- nest build')
p('<b>Expected:</b> tests, TypeScript checks and frontend compilation finish without errors. The last command checks Nest compilation without applying database migrations. A normal <b>npm run api:build</b> also connects to a database and runs migrations; do not mistake a missing local database for a TypeScript failure.')
step('3','Check what you upload','Commit source files, package-lock.json, Prisma migrations and deployment configuration. Keep .env files, private keys and tokens out of Git. .env.example is documentation, not a working production configuration; its short sample secrets are invalid.')
code('git status\ngit add <the-specific-files-you-changed>\ngit commit -m "Prepare deployment"\ngit push origin main')
note('Replace angle-bracket placeholders; do not paste them literally. If Git says nothing to commit, do not manufacture a change. Check that the intended commit is on GitHub.')

start('04 / First Vercel project','Reserve the frontend address')
step('1','Import the repository','In Vercel, choose Add New > Project > Import Git Repository. Select your SAAS repository. Grant access only as needed for this repository. Name the project saas-web, or choose your own name.')
table([['Frontend setting','Value'],['Framework Preset','Next.js'],['Root Directory','Repository root (leave empty / use ./)'],['Install Command','npm ci (npm install was used in the existing project)'],['Build Command','npm run build'],['Output Directory','Framework default; do not set out or dist'],['Node.js','24.x']], [185,322])
step('2','Deploy the frontend shell','Deploy to obtain a stable production domain. The landing page may work while login fails because the backend is not connected yet. Copy the exact production HTTPS origin into your notes. Do not use a temporary commit-specific preview address.')
code('FRONTEND_ORIGIN = https://YOUR-FRONTEND.vercel.app\nBACKEND_ORIGIN  = fill this in after creating the API')
p('These two names are labels for your notes, not environment variables the code reads. The actual variables are <b>APP_ORIGIN</b> on the backend and <b>API_INTERNAL_URL</b> on the frontend.')
step('3','For an existing project','Do not import it again. Open saas-web > Settings > Build and Deployment, check the table above, and record its existing production domain.')
note('Our existing frontend is https://saas-web-virid.vercel.app. Your new import can receive a different address. Always copy your own domain.')
p('Why frontend first? It gives you the exact address required by the backend origin check. You will return to this project and redeploy after the API is ready. [S2, S3]')

start('05 / Backend and database','Create the API + connect Neon')
step('1','Import the same repository again','Create a second Vercel project named saas-api. Select NestJS as the Framework Preset and <b>apps/api</b> as Root Directory. Keep Output Directory at its default. Use npm run build as Build Command, npm install as the observed Install Command, and Node.js 24.x. Enable inclusion of files outside the root directory for the workspace.')
step('2','Create the project before connecting storage','If Vercel requires an initial deployment to create the project, it can fail because database variables are absent. That is a setup checkpoint, not a reason to delete the project. Open the created project to finish configuration.')
step('3','Attach a Neon resource','Open saas-api > Storage > Create Database, choose Neon, then select an appropriate available free testing option. Follow the account/integration setup, choose a region near the API compute region, and connect the resource to <b>saas-api</b>. The observed API region was IAD1; choose based on the regions shown in your account.')
step('4','Check the database and branch','Confirm the resource says Available and lists the backend as a connected project. Use Production for the test deployment. Keep Preview on a separate database/branch if you will test schema changes; do not blindly point every preview at your main data.')
step('5','Set a real DATABASE_URL','In Neon connection details, select the intended branch, database and role. Copy its PostgreSQL connection string with pooling enabled and the supplied TLS parameters. Set it as DATABASE_URL in the backend project. The integration may also generate prefixed variables; the next page explains them. [S4, S5]')
note('Our resource is neon-crimson-cushion. If it is already connected, reuse it. Do not create an empty second database to troubleshoot a missing owner account.')
p('If Vercel/Neon asks for an authenticator code or passkey, complete that verification yourself. There is no deployment setting that legitimately substitutes for account verification.')

start('06 / Configure the backend','Environment variables')
p('Open saas-api > Environment Variables (or Settings > Environment Variables). Add each key separately for <b>Production</b>. Paste only the value, not KEY= and not surrounding quote characters. Save, then redeploy. Existing deployments do not pick up changed values automatically. [S3]')
table([['Backend key','Value / purpose'],['DATABASE_URL','Real Neon postgresql:// connection URL, including supplied TLS options. Never localhost in production.'],['JWT_SECRET','Generate 32 random bytes as hex (64 characters). Signs login sessions.'],['ENCRYPTION_KEY','Generate a separate 32-byte key as base64. Encrypts marketplace tokens.'],['APP_ORIGIN','Exact frontend HTTPS origin, without /login or a trailing slash.'],['SESSION_COOKIE_SECURE','true for HTTPS production. The current code requires this explicit value.']], [155,352])
h('Generate secrets locally - do not use tutorial passwords')
code('node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n\nnode -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"')
p('Run these in PowerShell, one command at a time. Use the first output for JWT_SECRET and the second for ENCRYPTION_KEY. Save them in your password manager; do not send screenshots of their values.')
h('Integration-prefixed variables')
p('The current Nest startup and migration runner try DATABASE_URL_POSTGRES_PRISMA_URL, DATABASE_URL_DATABASE_URL, then DATABASE_URL_POSTGRES_URL if DATABASE_URL is not a PostgreSQL URL. But the separate queue consumer does not run that fallback. Set a valid <b>DATABASE_URL directly</b> so both paths work.')
note('Never change ENCRYPTION_KEY casually after storing marketplace tokens; existing encrypted records need the original key. JWT rotation signs out existing sessions. Never prefix either secret with NEXT_PUBLIC_.')

start('07 / Build the database schema','Migrations and backend deploy')
h('What the backend build runs')
code('prisma generate\nnode scripts/migrate.cjs\nnest build')
p('<b>Generate</b> creates the Prisma client used by the API. <b>Migrate</b> applies checked-in SQL migrations to Neon. <b>Build</b> compiles NestJS. The migration runner loads a local .env if present and supports Windows execution. On Vercel, project environment variables provide the connection.')
step('1','Deploy the current commit','Push your reviewed changes or use Deployments > Redeploy on the latest intended deployment after editing variables. Check the commit hash: redeploying an old version rebuilds that old code.')
step('2','Read Build Logs','Check for successful Prisma client generation, migration completion/no pending migrations, and build completion. A red Error deployment is not live simply because installation succeeded.')
step('3','If migration did not run','Confirm the backend Build Command really is npm run build from apps/api. If tables are missing, use the explicit command below only from a terminal whose DATABASE_URL points to the intended Neon test database.')
code('npm run db:deploy --workspace @marketflow/api')
p('Do not run migrate reset against Neon to fix login. Do not use migrate dev as the production deployment command. For new schema work, create and test a migration locally, commit it, then apply migrate deploy to the target environment.')
step('4','Check function resources','Open the ready deployment > Resources. In the observed setup, two functions appear: /index for NestJS and /api/queues/marketplace-publishing for the callback. NestJS is deployed as a serverless function, not a server you manually start. [S6]')
note('A green deployment proves the build completed, not that every API route, account or marketplace operation works. Continue to the runtime checks.')

start('08 / The routing fix','Keep these two pieces together')
p('This project needed an explicit mapping to its deployed /index function. Removing the rewrite produced Vercel 404 responses; keeping the rewrite without normalization previously produced Cannot POST /index/api/auth/login. The repair is project-specific, not a rule for every NestJS app.')
code('apps/api/vercel.json\n\n"rewrites": [\n  {\n    "source": "/api/:path((?!queues(?:/|$)).*)",\n    "destination": "/index/api/:path"\n  },\n  { "source": "/", "destination": "/index/api/health" }\n]')
p('This is an excerpt. Keep the existing functions section with its queue trigger. The negative lookahead excludes /api/queues/... so the consumer keeps its own route.')
code('apps/api/src/routing.ts\n\nexport function apiRequestUrl(url: string): string {\n  return url.startsWith("/index/api/")\n    ? url.slice(6) : url;\n}')
p('main.ts applies this function to req.url before routing and origin checks, and uses the api global prefix. Together, the public /api/auth/login path reaches Nest as /api/auth/login. Query strings are preserved.')
h('How the repair was verified')
p('Regression checks covered rewritten login, query strings, unchanged direct paths, and queue exclusion. Nest compilation and lint passed. Commit <b>f2a6902</b> was pushed and deployed. The live frontend then redirected to login instead of the generic connection error.')
note('Do not copy only half of this fix or route the queue into Nest. Keep src/routing.ts, its main.ts call and vercel.json from the same commit.')

start('09 / Join the two projects','Connect the frontend to the API')
step('1','Record the backend production origin','Copy the stable backend domain from saas-api > Domains. For the existing test setup it is https://saas-api-xi.vercel.app.')
step('2','Set the frontend variable','Open saas-web > Environment Variables. Add API_INTERNAL_URL for Production with the backend origin only. Do not append /api or /index. Do not place database or JWT secrets in this project for the browser to use.')
code('Frontend project: saas-web\nAPI_INTERNAL_URL=https://saas-api-xi.vercel.app\n\nBackend project: saas-api\nAPP_ORIGIN=https://saas-web-virid.vercel.app')
step('3','Redeploy the frontend','The Next.js rewrite is created during build. Save the variable, then redeploy the latest frontend code. In a new account, never rely on the code fallback: it currently points at this existing test backend, not your new backend.')
step('4','Understand the browser request','The browser sends /api/... to its own frontend domain. next.config.ts forwards it to the backend. app/api.ts adds x-marketflow-request: web for writes and uses same-origin cookies. The backend permits writes only from APP_ORIGIN with that header.')
step('5','Retest after changing domains','If you rename the frontend domain or add a custom domain, update APP_ORIGIN and redeploy the API. If you rename the backend, update API_INTERNAL_URL and redeploy the frontend. Preview URLs will not automatically pass a single-production-origin policy.')
note('The observed second blocker was Request origin rejected. Setting APP_ORIGIN to the exact frontend origin and redeploying removed it. Do not disable the origin check to make a test pass.')
p('The web page and backend do not need the same public hostname because the frontend proxies API requests. Do not rewrite the browser client to call a second origin as a quick fix; that changes cookie and cross-origin behavior.')

start('10 / Prove it works','Registration and owner access')
step('1','Test a public API route','Open BACKEND_ORIGIN/api/health. Expect JSON with status: ok. Then open FRONTEND_ORIGIN/api/health. Expect the same shape. If only the second fails, investigate the frontend rewrite. A health response does not prove account records exist.')
step('2','Register in the deployed database','Open the deployed /login page and choose Create account. Enter your real email, name, organization name and a unique password of at least 10 characters. Submit only when ready to create that organization. Do not use a shared sample password.')
step('3','Open the dashboard','Registration creates a user, organization and OWNER membership, then issues a session cookie. Confirm /dashboard loads. Under Settings, confirm the expected email and OWNER role. Sign out and sign in again to test an existing account.')
step('4','Check account data if needed','Open the connected Neon resource > Query or Data Editor and complete the identity check. The read-only SQL below shows users and organization roles without selecting password hashes.')
code('SELECT u.email, u.name, m.role, o.name AS organization\nFROM "User" u\nJOIN "Membership" m ON m."userId" = u.id\nJOIN "Organization" o ON o.id = m."organizationId"\nORDER BY u.email;')
h('What happened with the demo account')
p('demo@marketflow.test with the earlier suggested password was tested and returned Invalid email or password. Those are not verified production credentials. Passwords are hashed, so the original password cannot be read back. A local account must be registered or deliberately migrated to Neon; deploying source does not transfer it.')
note('The last verified live result was an invalid-credentials response, not a completed owner login. Neon data inspection was blocked by two-factor verification. Do not record owner access as passed until you actually see the dashboard.')

start('11 / Beyond login','Queues, marketplaces and images')
h('Publishing is a separate verification stage')
p('The API calls send("marketplace-publishing", { publishJobId }). The standalone callback uses handleCallback and updates PublishJob and Listing records. The existing vercel.json trigger binds that topic to the consumer. Vercel Queues is currently beta and available across plans; review its limits and operation pricing. [S7]')
code('"functions": {\n  "api/queues/marketplace-publishing.ts": {\n    "experimentalTriggers": [{\n      "type": "queue/v2beta",\n      "topic": "marketplace-publishing"\n    }]\n  }\n}')
p('Do not test the queue callback by submitting a browser login request to it. Use an approved marketplace sandbox account and a disposable test product. Submit once, inspect the job record and function logs, then verify the remote listing. A completed build alone does not prove queue execution. The callback lives outside src, so nest build alone does not check it.')
h('Marketplace prerequisites')
p('Shopify needs an authorized app/token; OAuth needs client configuration and the registered callback /api/stores/oauth/shopify/callback. eBay needs a token and listing policies. Flipkart needs approved API access. Amazon currently requires the configured HTTPS signing gateway. Do not publish to real seller accounts as an infrastructure smoke test.')
h('Image uploads are not ready for durable Vercel use')
p('app.service.ts currently writes uploaded bytes to local ./storage and records metadata in PostgreSQL. A serverless filesystem is not a persistent shared image store. Neon stores the metadata, not those file bytes. Setting STORAGE_PATH=/tmp does not make images durable. [S8]')
note('Before full product-upload testing, implement an object-storage adapter (for example Vercel Blob, S3 or R2), persist object keys, and update image reads and marketplace access. Adding a storage environment variable alone cannot fix this. This guide does not implement that feature.')

start('12 / Troubleshooting','Match the error to the layer')
table([['What you see','Check and fix'],['Vercel 404 NOT_FOUND','Deployment/domain/function routing. Confirm the latest commit and the /index function. Keep the routing pair on page 9.'],['Cannot POST /index/api/auth/login','Nest received the rewrite prefix. Check apiRequestUrl middleware in main.ts.'],['Cannot GET /','May simply mean no root route. Test /api/health; this repository also maps / to health.'],['DATABASE_URL is required','Backend environment missing or wrong environment scope. Set a real Neon URL and redeploy.'],['Prisma P1012: URL protocol','DATABASE_URL must start postgresql:// or postgres://. Do not paste psql commands, KEY=, quotes or a dashboard URL.'],['JWT_SECRET must be at least 32 characters','Replace the sample with a strong generated secret in the backend; redeploy.'],['Request origin rejected','Exact APP_ORIGIN mismatch or missing x-marketflow-request header. Use the deployed frontend and page 10.'],['Invalid email or password','Routing reached auth. Verify the account in the same Neon database, or register a new owner workspace.'],['Request failed / Retry connection','Generic frontend message. Inspect Network status and response; it alone does not identify the cause.'],['Prisma missing table / connection error','Check target branch/database and migration logs. Apply checked-in migrations; do not reset the database.']], [169,338])
p('In the browser press F12 > Network, retry once, and select the failed /api request. Record its URL, method, status and response. In Vercel, open the backend deployment > Logs and find the same time/request. Share errors with credentials and tokens removed.',small)

start('13 / Updates and acceptance','A repeatable release checklist')
h('For every future code update')
p('1. Review the changed files and run tests, lint and builds.<br/>2. Commit and push to main.<br/>3. Open both Vercel projects; confirm the intended commit, not only a green status.<br/>4. Wait for Ready and production domain assignment.<br/>5. Run the checks below and inspect runtime logs if anything fails.')
table([['Test','Expected result'],['Backend and frontend /api/health','JSON status: ok through both URLs'],['Unauthenticated /dashboard','Redirect to /login'],['Register + sign out + sign in','Expected owner workspace; no generic connection error'],['Create/edit a test product, refresh','Saved data survives refresh and login'],['Settings and permissions','Correct email, organization and OWNER role'],['Upload image','Deferred until durable object storage is implemented'],['Publish sandbox listing','Verify queue delivery AND remote listing before calling it passed']], [247,260])
h('Rollback without damaging data')
p('If a new release breaks a previously working flow, promote or roll back to a known-good deployment in Vercel, then investigate. Code rollback does not reverse database migrations. Take an appropriate backup/restore point before risky schema changes and verify the chosen Neon plan supports the recovery you need.')
h('Before inviting real sellers')
p('Finish persistent uploads, test queue retries and duplicate deliveries, verify provider authorization, and review rate limits and backup recovery. Set secure cookies explicitly. Run a fresh dependency audit; do not rely on the README statement of zero vulnerabilities. Never run npm audit fix --force blindly.')
note('Completion of deployment means the tested routes run. It does not certify every workflow, eliminate all vulnerabilities or make the SaaS commercially production-ready.')

start('14 / Reference desk','Sources and final checklist')
p('Official documentation consulted on 14 September 2026. UI labels and plan allowances can change; use these links if your dashboard looks different. Instructions specific to MarketFlow come from the repository and this session, not from a generic template.')
sources=[('S1','Vercel Hobby plan','https://vercel.com/docs/plans/hobby'),('S2','Vercel monorepos','https://vercel.com/docs/monorepos'),('S3','Vercel environment variables','https://vercel.com/docs/environment-variables'),('S4','Connect Vercel and Neon','https://neon.com/docs/guides/vercel-manual'),('S5','Neon pooled connections and Prisma migrations','https://neon.com/blog/better-postgres-with-prisma-experience'),('S6','NestJS on Vercel','https://vercel.com/docs/frameworks/backend/nestjs'),('S7','Vercel Queues','https://vercel.com/docs/queues'),('S8','Vercel Node.js runtime','https://vercel.com/docs/functions/runtimes/node-js')]
for key,title,url in sources: p(f'<b>{key}</b> - <link href="{url}" color="#5B2A86">{title}</link>',gap=7)
h('Keep this beside the Vercel dashboard')
p('[ ] Frontend root is the repository root.<br/>[ ] Backend root is apps/api; preset is NestJS.<br/>[ ] Neon is connected to the backend and correct branch.<br/>[ ] DATABASE_URL is valid for both API and queue.<br/>[ ] Backend secrets are generated and stored safely.<br/>[ ] APP_ORIGIN and API_INTERNAL_URL match the real domains.<br/>[ ] SESSION_COOKIE_SECURE=true in production.<br/>[ ] Current routing commit is deployed.<br/>[ ] Environment changes were followed by redeployment.<br/>[ ] Registration/login and saved data were actually tested.<br/>[ ] Image and marketplace limitations are understood.')
p('<b>Project sources:</b> package.json; next.config.ts; app/api.ts; apps/api/package.json; src/main.ts; src/routing.ts; src/app.service.ts; prisma/schema.prisma; scripts/migrate.cjs; vercel.json; api/queues/marketplace-publishing.ts. Paths are relative to the repository or backend root as shown on page 3.',small)
c.save()
print(f'Created {OUT} ({page} pages)')

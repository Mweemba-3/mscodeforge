import os
import re
import secrets
import hashlib
import hmac
from io import BytesIO
from datetime import datetime, timezone, timedelta
from functools import wraps
from pathlib import Path
from urllib.parse import urlsplit
from dotenv import load_dotenv

from flask import (
    Flask, abort, flash, redirect, render_template, request,
    url_for
)
from flask_login import (
    LoginManager, UserMixin, current_user, login_required,
    login_user, logout_user
)
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import FlaskForm
from flask_wtf.csrf import CSRFProtect
from werkzeug.security import generate_password_hash, check_password_hash
from wtforms import (
    StringField, TextAreaField, PasswordField, BooleanField,
    SelectField, SubmitField
)
from wtforms.validators import DataRequired, Email, Length, Optional, URL
from PIL import Image, ImageOps, UnidentifiedImageError
from vercel.blob import sync as blob_storage

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_STATIC_DIR = BASE_DIR / "public" / "static"
UPLOAD_DIR = PUBLIC_STATIC_DIR / "uploads"
IS_VERCEL = bool(os.getenv("VERCEL"))

app = Flask(
    __name__,
    static_folder=str(PUBLIC_STATIC_DIR),
    static_url_path="/static",
)

secret_key = os.getenv("SECRET_KEY")
database_url = os.getenv("DATABASE_URL")
if not secret_key or len(secret_key) < 32:
    raise RuntimeError("a79790111fa2e79ab64cafe333dfc372e857e335ffe3dd6b47e6537741b6baea")
if not database_url:
    raise RuntimeError("DATABASE_URL is missing. Configure hosted PostgreSQL.")

if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

app.config.update(
    SECRET_KEY=secret_key,
    SQLALCHEMY_DATABASE_URI=database_url,
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    SQLALCHEMY_ENGINE_OPTIONS={
        "pool_pre_ping": True, "pool_recycle": 300,
        "pool_size": 2, "max_overflow": 0,
    },
    MAX_CONTENT_LENGTH=4 * 1024 * 1024,
    UPLOAD_FOLDER=str(UPLOAD_DIR),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "true" if IS_VERCEL else "false").lower() == "true",
    REMEMBER_COOKIE_HTTPONLY=True,
    REMEMBER_COOKIE_SAMESITE="Lax",
    REMEMBER_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "true" if IS_VERCEL else "false").lower() == "true",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
)

if not IS_VERCEL:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

db = SQLAlchemy(app)
csrf = CSRFProtect(app)

login_manager = LoginManager(app)
login_manager.login_view = "admin_login"
login_manager.login_message_category = "warning"
login_manager.session_protection = "strong"

from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

Image.MAX_IMAGE_PIXELS = 20_000_000

@app.after_request
def add_security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' https: data:; style-src 'self'; "
        "script-src 'self'; object-src 'none'; base-uri 'self'; "
        "frame-ancestors 'none'; form-action 'self'"
    )
    if request.is_secure:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if request.path.startswith("/admin"):
        response.headers["Cache-Control"] = "no-store, private"
    return response


ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}
MAX_IMAGE_BYTES = 2 * 1024 * 1024


def slugify(value):
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return value.strip("-") or secrets.token_hex(4)


def media_url(value):
    if not value:
        return ""
    if value.startswith(("https://", "http://")):
        return value
    return url_for("static", filename=f"uploads/{value}")


def save_images(files):
    saved = []

    for file in files:
        if not file or not file.filename:
            continue

        raw = file.stream.read(MAX_IMAGE_BYTES + 1)

        if len(raw) > MAX_IMAGE_BYTES:
            raise ValueError("Each image must be 2 MB or smaller.")

        try:
            with Image.open(BytesIO(raw)) as source:
                source.verify()

            with Image.open(BytesIO(raw)) as source:
                source.load()
                image = ImageOps.exif_transpose(source)

                if image.mode not in ("RGB", "RGBA"):
                    image = image.convert(
                        "RGBA" if "transparency" in image.info else "RGB"
                    )

                output = BytesIO()
                image.save(output, format="WEBP", quality=88, method=6)
                safe_bytes = output.getvalue()

        except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
            raise ValueError("The uploaded file is not a valid supported image.")

        filename = f"{secrets.token_hex(16)}.webp"

        if IS_VERCEL:
            if not os.getenv("BLOB_READ_WRITE_TOKEN"):
                raise ValueError(
                    "Add BLOB_READ_WRITE_TOKEN to your Vercel environment variables."
                )

            blob = blob_storage.put_blob(
                f"ms-codeforge/uploads/{filename}",
                safe_bytes,
                access="public",
                content_type="image/webp",
                add_random_suffix=True,
            )

            saved.append(blob.url)

        else:
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            (UPLOAD_DIR / filename).write_bytes(safe_bytes)
            saved.append(filename)

    return saved


class Admin(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), nullable=False)
    slug = db.Column(db.String(180), unique=True, nullable=False)
    short_description = db.Column(db.String(300), nullable=False)
    description = db.Column(db.Text, nullable=False)
    features = db.Column(db.Text, default="")
    technologies = db.Column(db.String(500), default="")
    platform = db.Column(db.String(120), default="")
    status = db.Column(db.String(50), default="In Development")
    logo = db.Column(db.String(255))
    screenshots = db.Column(db.JSON, default=list)
    website_url = db.Column(db.String(500), default="")
    download_url = db.Column(db.String(500), default="")
    published = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class NewsPost(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(180), nullable=False)
    slug = db.Column(db.String(200), unique=True, nullable=False)
    summary = db.Column(db.String(400), nullable=False)
    body = db.Column(db.Text, nullable=False)
    published = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class ContactMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), nullable=False)
    subject = db.Column(db.String(180), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    read = db.Column(db.Boolean, default=False, nullable=False)


class AdminLoginAttempt(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ip_digest = db.Column(db.String(64), index=True, nullable=False)
    attempted_at = db.Column(db.DateTime, default=datetime.utcnow, index=True, nullable=False)


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(Admin, int(user_id))


class LoginForm(FlaskForm):
    username = StringField("Username", validators=[DataRequired(), Length(max=80)])
    password = PasswordField("Password", validators=[DataRequired()])
    submit = SubmitField("Sign in")


class ProductForm(FlaskForm):
    name = StringField("Product name", validators=[DataRequired(), Length(max=160)])
    short_description = StringField("Short description", validators=[DataRequired(), Length(max=300)])
    description = TextAreaField("Full description", validators=[DataRequired()])
    features = TextAreaField("Features (one per line)", validators=[Optional()])
    technologies = StringField("Technologies (comma-separated)", validators=[Optional(), Length(max=500)])
    platform = StringField("Platform", validators=[Optional(), Length(max=120)])
    status = SelectField("Status", choices=[
        ("Research", "Research"), ("Planning", "Planning"),
        ("In Development", "In Development"), ("Testing", "Testing"),
        ("Production", "Production"), ("Archived", "Archived")
    ])
    website_url = StringField("Website URL", validators=[Optional(), Length(max=500), URL(schemes=["https"])])
    download_url = StringField("Download URL", validators=[Optional(), Length(max=500), URL(schemes=["https"])])
    published = BooleanField("Publish this product")
    submit = SubmitField("Save product")


class NewsForm(FlaskForm):
    title = StringField("Title", validators=[DataRequired(), Length(max=180)])
    summary = StringField("Summary", validators=[DataRequired(), Length(max=400)])
    body = TextAreaField("Article", validators=[DataRequired()])
    published = BooleanField("Publish this update")
    submit = SubmitField("Save update")


class ContactForm(FlaskForm):
    name = StringField("Your name", validators=[DataRequired(), Length(max=120)])
    email = StringField("Email address", validators=[DataRequired(), Email(), Length(max=180)])
    subject = StringField("Subject", validators=[DataRequired(), Length(max=180)])
    message = TextAreaField("Message", validators=[DataRequired(), Length(min=10, max=5000)])
    submit = SubmitField("Send message")


def admin_required(view):
    @wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        return view(*args, **kwargs)
    return wrapped


def login_ip_digest():
    address = request.remote_addr or "unknown"
    return hmac.new(app.config["SECRET_KEY"].encode(), address.encode(), hashlib.sha256).hexdigest()


@app.context_processor
def inject_media_helpers():
    return {"media_url": media_url}


@app.context_processor
def inject_globals():
    return {"current_year": datetime.now(timezone.utc).year}


@app.route("/")
def home():
    products = Product.query.filter_by(published=True).order_by(Product.created_at.desc()).limit(3).all()
    updates = NewsPost.query.filter_by(published=True).order_by(NewsPost.created_at.desc()).limit(3).all()
    return render_template("index.html", products=products, updates=updates)


@app.route("/products")
def products():
    term = request.args.get("q", "").strip()
    query = Product.query.filter_by(published=True)
    if term:
        pattern = f"%{term}%"
        query = query.filter(
            db.or_(
                Product.name.ilike(pattern),
                Product.short_description.ilike(pattern),
                Product.description.ilike(pattern),
                Product.features.ilike(pattern),
                Product.technologies.ilike(pattern),
                Product.platform.ilike(pattern)
            )
        )
    items = query.order_by(Product.created_at.desc()).all()
    return render_template("products.html", products=items, search_term=term)


@app.route("/products/<slug>")
def product_detail(slug):
    product = Product.query.filter_by(slug=slug, published=True).first_or_404()
    return render_template("product_detail.html", product=product)


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/news")
def news():
    posts = NewsPost.query.filter_by(published=True).order_by(NewsPost.created_at.desc()).all()
    return render_template("news.html", posts=posts)


@app.route("/news/<slug>")
def news_detail(slug):
    post = NewsPost.query.filter_by(slug=slug, published=True).first_or_404()
    return render_template("news_detail.html", post=post)


@app.route("/contact", methods=["GET", "POST"])
def contact():
    form = ContactForm()
    if form.validate_on_submit():
        item = ContactMessage(
            name=form.name.data.strip(),
            email=form.email.data.strip(),
            subject=form.subject.data.strip(),
            message=form.message.data.strip()
        )
        db.session.add(item)
        db.session.commit()
        flash("Your message has been received. Thank you for contacting us.", "success")
        return redirect(url_for("contact"))
    return render_template("contact.html", form=form)


# ==========================================
# LEGAL CENTRE AND POLICY PAGES
# ==========================================

@app.route("/legal/")
def legal_centre():
    return render_template("legal/index.html")


@app.route("/legal/<slug>")
def legal_page(slug):
    legal_pages = {
        "terms-of-service": "terms_of_service.html",
        "privacy-policy": "privacy_policy.html",
        "cookie-policy": "cookie_policy.html",
        "acceptable-use": "acceptable_use.html",
        "content-removal": "content_removal.html",
        "copyright-notice": "copyright_notice.html",
        "appeals": "appeals.html",
        "account-enforcement": "account_enforcement.html",
        "legal-requests": "legal_requests.html",
        "software-licensing": "software_licensing.html",
        "service-availability": "service_availability.html",
        "third-party": "third_party.html",
        "security-disclosure": "security_disclosure.html",
        "complaints-disputes": "complaints_disputes.html",
    }
    filename = legal_pages.get(slug)
    if filename is None:
        abort(404)
    return render_template("legal/" + filename)


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if current_user.is_authenticated:
        return redirect(url_for("admin_dashboard"))
    form = LoginForm()
    if form.validate_on_submit():
        ip_digest = login_ip_digest()
        cutoff = datetime.utcnow() - timedelta(minutes=15)
        failures = AdminLoginAttempt.query.filter(
            AdminLoginAttempt.ip_digest == ip_digest,
            AdminLoginAttempt.attempted_at >= cutoff,
        ).count()
        if failures >= 10:
            flash("Too many sign-in attempts. Try again in 15 minutes.", "danger")
            return render_template("admin/login.html", form=form), 429

        admin = Admin.query.filter_by(username=form.username.data.strip()).first()
        if admin and admin.check_password(form.password.data):
            AdminLoginAttempt.query.filter_by(ip_digest=ip_digest).delete()
            db.session.commit()
            login_user(admin)
            flash("Welcome back.", "success")
            next_page = request.args.get("next", "")
            parsed = urlsplit(next_page)
            if (not next_page.startswith("/") or next_page.startswith("//")
                    or parsed.scheme or parsed.netloc or "\\" in next_page):
                next_page = url_for("admin_dashboard")
            return redirect(next_page)
        db.session.add(AdminLoginAttempt(ip_digest=ip_digest))
        db.session.commit()
        flash("Invalid username or password.", "danger")
    return render_template("admin/login.html", form=form)


@app.route("/admin/logout", methods=["POST"])
@admin_required
def admin_logout():
    logout_user()
    flash("You have been signed out.", "success")
    return redirect(url_for("admin_login"))


@app.route("/admin")
@admin_required
def admin_dashboard():
    return render_template(
        "admin/dashboard.html",
        product_count=Product.query.count(),
        published_count=Product.query.filter_by(published=True).count(),
        news_count=NewsPost.query.count(),
        message_count=ContactMessage.query.count(),
        recent_messages=ContactMessage.query.order_by(ContactMessage.created_at.desc()).limit(5).all()
    )


@app.route("/admin/products")
@admin_required
def admin_products():
    items = Product.query.order_by(Product.created_at.desc()).all()
    return render_template("admin/products.html", products=items)


@app.route("/admin/products/new", methods=["GET", "POST"])
@admin_required
def admin_product_new():
    form = ProductForm()
    if form.validate_on_submit():
        slug = slugify(form.name.data)
        if Product.query.filter_by(slug=slug).first():
            slug = f"{slug}-{secrets.token_hex(3)}"
        try:
            images = save_images(request.files.getlist("screenshots"))
            logos = save_images([request.files.get("logo")])
        except ValueError as error:
            flash(str(error), "danger")
            return render_template("admin/product_form.html", form=form, heading="Add product", product=None)
        item = Product(
            name=form.name.data.strip(), slug=slug,
            short_description=form.short_description.data.strip(),
            description=form.description.data.strip(),
            features=form.features.data or "",
            technologies=form.technologies.data or "",
            platform=form.platform.data or "",
            status=form.status.data,
            website_url=form.website_url.data or "",
            download_url=form.download_url.data or "",
            published=form.published.data,
            logo=logos[0] if logos else None,
            screenshots=images
        )
        db.session.add(item)
        db.session.commit()
        flash("Product created.", "success")
        return redirect(url_for("admin_products"))
    return render_template("admin/product_form.html", form=form, heading="Add product", product=None)


@app.route("/admin/products/<int:product_id>/edit", methods=["GET", "POST"])
@admin_required
def admin_product_edit(product_id):
    item = db.get_or_404(Product, product_id)
    form = ProductForm(obj=item)
    if request.method == "GET":
        form.features.data = item.features
    if form.validate_on_submit():
        try:
            new_images = save_images(request.files.getlist("screenshots"))
            new_logo = save_images([request.files.get("logo")])
        except ValueError as error:
            flash(str(error), "danger")
            return render_template("admin/product_form.html", form=form, heading="Edit product", product=item)
        item.name = form.name.data.strip()
        item.short_description = form.short_description.data.strip()
        item.description = form.description.data.strip()
        item.features = form.features.data or ""
        item.technologies = form.technologies.data or ""
        item.platform = form.platform.data or ""
        item.status = form.status.data
        item.website_url = form.website_url.data or ""
        item.download_url = form.download_url.data or ""
        item.published = form.published.data
        if new_logo:
            item.logo = new_logo[0]
        if new_images:
            item.screenshots = (item.screenshots or []) + new_images
        db.session.commit()
        flash("Product updated.", "success")
        return redirect(url_for("admin_products"))
    return render_template("admin/product_form.html", form=form, heading="Edit product", product=item)


@app.route("/admin/products/<int:product_id>/delete", methods=["POST"])
@admin_required
def admin_product_delete(product_id):
    item = db.get_or_404(Product, product_id)
    db.session.delete(item)
    db.session.commit()
    flash("Product deleted.", "success")
    return redirect(url_for("admin_products"))


@app.route("/admin/news")
@admin_required
def admin_news():
    posts = NewsPost.query.order_by(NewsPost.created_at.desc()).all()
    return render_template("admin/news.html", posts=posts)


@app.route("/admin/news/new", methods=["GET", "POST"])
@admin_required
def admin_news_new():
    form = NewsForm()
    if form.validate_on_submit():
        slug = slugify(form.title.data)
        if NewsPost.query.filter_by(slug=slug).first():
            slug = f"{slug}-{secrets.token_hex(3)}"
        post = NewsPost(
            title=form.title.data.strip(), slug=slug,
            summary=form.summary.data.strip(), body=form.body.data.strip(),
            published=form.published.data
        )
        db.session.add(post)
        db.session.commit()
        flash("Update created.", "success")
        return redirect(url_for("admin_news"))
    return render_template("admin/news_form.html", form=form, heading="Create update")


@app.route("/admin/news/<int:post_id>/edit", methods=["GET", "POST"])
@admin_required
def admin_news_edit(post_id):
    post = db.get_or_404(NewsPost, post_id)
    form = NewsForm(obj=post)
    if form.validate_on_submit():
        post.title = form.title.data.strip()
        post.summary = form.summary.data.strip()
        post.body = form.body.data.strip()
        post.published = form.published.data
        db.session.commit()
        flash("Update saved.", "success")
        return redirect(url_for("admin_news"))
    return render_template("admin/news_form.html", form=form, heading="Edit update")


@app.route("/admin/news/<int:post_id>/delete", methods=["POST"])
@admin_required
def admin_news_delete(post_id):
    post = db.get_or_404(NewsPost, post_id)
    db.session.delete(post)
    db.session.commit()
    flash("Update deleted.", "success")
    return redirect(url_for("admin_news"))


@app.route("/admin/messages")
@admin_required
def admin_messages():
    messages = ContactMessage.query.order_by(ContactMessage.created_at.desc()).all()
    return render_template("admin/messages.html", messages=messages)


@app.route("/admin/messages/<int:message_id>/read", methods=["POST"])
@admin_required
def admin_message_read(message_id):
    message = db.get_or_404(ContactMessage, message_id)
    message.read = True
    db.session.commit()
    flash("Message marked as read.", "success")
    return redirect(url_for("admin_messages"))


@app.cli.command("init-db")
def init_db():
    """Create tables. Run: flask --app app init-db"""
    db.create_all()
    print("Database tables created.")


@app.cli.command("create-admin")
def create_admin():
    """Create the first admin. Run: flask --app app create-admin"""
    import getpass
    username = input("Admin username: ").strip()
    if not username:
        print("Username cannot be empty.")
        return
    if Admin.query.filter_by(username=username).first():
        print("That username already exists.")
        return
    password = getpass.getpass("Admin password (minimum 12 characters): ")
    confirm = getpass.getpass("Confirm password: ")
    if len(password) < 12 or password != confirm:
        print("Passwords must match and contain at least 12 characters.")
        return
    admin = Admin(username=username)
    admin.set_password(password)
    db.session.add(admin)
    db.session.commit()
    print("Administrator created.")


@app.errorhandler(413)
def too_large(_error):
    return render_template("errors/413.html"), 413


@app.errorhandler(404)
def not_found(_error):
    return render_template("errors/404.html"), 404


@app.errorhandler(500)
def server_error(_error):
    db.session.rollback()
    return render_template("errors/500.html"), 500


if __name__ == "__main__":
    app.run(debug=(not IS_VERCEL and os.getenv("FLASK_DEBUG", "false").lower() == "true"))

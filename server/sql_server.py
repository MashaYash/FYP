from fastapi import FastAPI
import psycopg2
from psycopg2.extras import RealDictCursor  
import bcrypt
from fastapi import HTTPException
from pydantic import BaseModel
from utilClasses import LoginRequest,RegisterRequest

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str


DbLayer = FastAPI()

DB_CONFIG = {
    "host": "localhost",
    "database": "allergy_genie",
    "user": "postgres",
    "password": "root342",
    "port": 5433
}


@DbLayer.get("/")
def root():
    return {"message": "DB Layer Server Running"}


@DbLayer.get("/health")
def health_check():
    try:
        conn = psycopg2.connect(
            host=DB_CONFIG["host"],
            database=DB_CONFIG["database"],
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"],
            port=DB_CONFIG["port"]
        )

        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Simple query to test users table
        cursor.execute("SELECT COUNT(*) AS user_count FROM users;")
        result = cursor.fetchone()

        cursor.close()
        conn.close()

        return {
            "status": "healthy",
            "database": "connected",
            "users_table": "reachable",
            "user_count": result["user_count"]
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
    
@DbLayer.get("/check-email")
def check_email(email: str):
    try:
        conn = psycopg2.connect(
            host=DB_CONFIG["host"],
            database=DB_CONFIG["database"],
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"],
            port=DB_CONFIG["port"]
        )

        cursor = conn.cursor(cursor_factory=RealDictCursor)

        query = "SELECT EXISTS(SELECT 1 FROM users WHERE email = %s);"
        cursor.execute(query, (email,))

        result = cursor.fetchone()

        cursor.close()
        conn.close()

        return {
            "exists": result["exists"]
        }

    except Exception as e:
        return {
            "error": str(e)
        }


@DbLayer.post("/register")
def register(request: RegisterRequest):

    try:

        first_name = request.first_name
        last_name = request.last_name
        email = request.email
        password = request.password

        conn = psycopg2.connect(
            host=DB_CONFIG["host"],
            database=DB_CONFIG["database"],
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"],
            port=DB_CONFIG["port"]
        )

        cursor = conn.cursor(cursor_factory=RealDictCursor)


        cursor.execute(
            "SELECT EXISTS(SELECT 1 FROM users WHERE email = %s);",
            (email,)
        )

        exists = cursor.fetchone()["exists"]

        if exists:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Email already registered")


        hashed_password = bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")


        insert_query = """
            INSERT INTO users (first_name, last_name, email, password)
            VALUES (%s, %s, %s, %s)
            RETURNING id;
        """

        cursor.execute(
            insert_query,
            (first_name, last_name, email, hashed_password)
        )

        user_id = cursor.fetchone()["id"]

        conn.commit()
        cursor.close()
        conn.close()

        return {
            "success": True,
            "message": "User registered successfully",
            "user_id": user_id
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    
@DbLayer.post("/login")
def login(request: LoginRequest):

    email = request.email
    password = request.password

    try:
        # =========================
        # Connect DB
        # =========================
        conn = psycopg2.connect(
            host=DB_CONFIG["host"],
            database=DB_CONFIG["database"],
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"],
            port=DB_CONFIG["port"]
        )

        cursor = conn.cursor(cursor_factory=RealDictCursor)


        cursor.execute(
            "SELECT * FROM users WHERE email = %s;",
            (email,)
        )

        user = cursor.fetchone()

        cursor.close()
        conn.close()

        if not user:
            raise HTTPException(status_code=400, detail="Invalid email or password")

        password_match = bcrypt.checkpw(
            password.encode("utf-8"),
            user["password"].encode("utf-8")
        )

        if not password_match:
            raise HTTPException(status_code=400, detail="Invalid email or password")

        return {
            "success": True,
            "message": "Login successful",
            "user_id": user["id"],
            "email": user["email"]
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
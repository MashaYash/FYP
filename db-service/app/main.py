from fastapi import FastAPI
import psycopg2
from psycopg2.extras import RealDictCursor ,Json
import bcrypt
from fastapi import HTTPException
from pydantic import BaseModel
from utilities import LoginRequest,RegisterRequest
import os

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str

class ReportRequest(BaseModel):
    user_id: int
    report_date: str
    report: dict


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
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )

        cursor = conn.cursor()

        cursor.execute("SELECT 1;")
        cursor.fetchone()

        cursor.close()
        conn.close()

        return {
            "status": "healthy",
            "database": "connected"
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
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
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

    except psycopg2.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )

@DbLayer.get("/get-reports-by-id")
def get_reports(user_id: int, report_date: str):
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )

        cursor = conn.cursor(cursor_factory=RealDictCursor)

        query = """
            SELECT id, user_id, report_date, report, created_at
            FROM reports
            WHERE user_id = %s
            AND report_date::date = %s::date
            ORDER BY report_date DESC;
        """

        cursor.execute(query, (user_id, report_date))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        import json as _json

        serialised = []
        for row in rows:
            report_val = row["report"]
            if isinstance(report_val, str):
                try:
                    report_val = _json.loads(report_val)
                except Exception:
                    report_val = {}
            serialised.append({
                "id":          row["id"],
                "user_id":     row["user_id"],
                "report_date": str(row["report_date"]),
                "created_at":  str(row["created_at"]),
                "report":      report_val,
            })

        return {
            "count":   len(serialised),
            "reports": serialised,
        }

    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    

@DbLayer.post("/save-report")
def save_report(data: ReportRequest):
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )

        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Ensure the reports table exists with JSONB column
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                report_date TIMESTAMP NOT NULL,
                report JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_user FOREIGN KEY (user_id)
                    REFERENCES users(id) ON DELETE CASCADE
            );
        """)
        conn.commit()

        query = """
            INSERT INTO reports (user_id, report_date, report)
            VALUES (%s, %s, %s)
            RETURNING id, user_id, report_date, created_at;
        """

        cursor.execute(query, (data.user_id, data.report_date, Json(data.report)))
        result = cursor.fetchone()
        print("Inserted report:", result)

        conn.commit()
        cursor.close()
        conn.close()

        # Serialise timestamps to string for JSON response
        return {
            "success": True,
            "report": {
                "id":          result["id"],
                "user_id":     result["user_id"],
                "report_date": str(result["report_date"]),
                "created_at":  str(result["created_at"]),
            }
        }

    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        return {"success": False, "error": str(e)}

@DbLayer.delete("/delete-user-reports")
def delete_user_reports(user_id: int):
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )

        cursor = conn.cursor(cursor_factory=RealDictCursor)

        query = """
            DELETE FROM reports
            WHERE user_id = %s
            RETURNING id;
        """

        cursor.execute(query, (user_id,))
        deleted_reports = cursor.fetchall()

        conn.commit()

        deleted_count = len(deleted_reports)

        cursor.close()
        conn.close()

        return {
            "success": True,
            "deleted_count": deleted_count
        }

    except Exception as e:
        return {
            "success": False,
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
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )

        cursor = conn.cursor(cursor_factory=RealDictCursor)


        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );
        """)

        conn.commit()

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

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    
@DbLayer.post("/login")
def login(request: LoginRequest):

    email = request.email
    password = request.password

    try:
        # =========================
        # Connect DB
        # =========================
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
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
            "id": user["id"],
            "email": user["email"],
            "first_name": user["first_name"],
            "last_name": user["last_name"]
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    


@DbLayer.get("/get-all-reports")
def get_all_reports(user_id: int):
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """
            SELECT id, user_id, report_date, report, created_at
            FROM reports
            WHERE user_id = %s
            ORDER BY report_date DESC;
            """,
            (user_id,)
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        import json as _json

        serialised = []
        for row in rows:
            # report column: JSONB → already a dict; TEXT → parse it
            report_val = row["report"]
            if isinstance(report_val, str):
                try:
                    report_val = _json.loads(report_val)
                except Exception:
                    report_val = {}

            serialised.append({
                "id":          row["id"],
                "user_id":     row["user_id"],
                "report_date": str(row["report_date"]),
                "created_at":  str(row["created_at"]),
                "report":      report_val,
            })

        return {"success": True, "reports": serialised}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@DbLayer.patch("/update-user")
def update_user(data: dict):
    user_id = data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Keep existing databases compatible with the profile editor.
        cursor.execute("""
            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS age VARCHAR(30),
                ADD COLUMN IF NOT EXISTS gender VARCHAR(30),
                ADD COLUMN IF NOT EXISTS address TEXT;
        """)

        # Build dynamic update — only update columns that are provided
        allowed = ["first_name", "last_name", "email", "phone", "date_of_birth",
                   "age", "gender", "address", "emergency_contact_name", "emergency_contact_phone",
                   "known_allergies", "blood_type", "notes"]
        fields = {k: v for k, v in data.items() if k in allowed and v is not None}

        if not fields:
            cursor.close(); conn.close()
            return {"success": True, "message": "Nothing to update"}

        set_clause = ", ".join(f"{k} = %s" for k in fields)
        values = list(fields.values()) + [user_id]

        cursor.execute(
            f"UPDATE users SET {set_clause} WHERE id = %s RETURNING *;",
            values
        )
        updated = cursor.fetchone()
        conn.commit()
        cursor.close(); conn.close()

        if not updated:
            raise HTTPException(status_code=404, detail="User not found")

        return {"success": True, "user": dict(updated)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

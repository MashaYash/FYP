from pydantic import BaseModel

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email :str
    password :str
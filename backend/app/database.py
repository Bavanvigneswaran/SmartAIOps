from sqlalchemy import create_engine, Column, Integer, Float, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./smartaiops.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


# ── Tables ──────────────────────────────────────────────

class MetricRecord(Base):
    __tablename__ = "metrics"

    id         = Column(Integer, primary_key=True, index=True)
    timestamp  = Column(DateTime, default=datetime.utcnow)
    cpu        = Column(Float)
    memory     = Column(Float)
    latency    = Column(Float)
    error_rate = Column(Float)


class AlertRecord(Base):
    __tablename__ = "alerts"

    id           = Column(Integer, primary_key=True, index=True)
    metric       = Column(String)
    value        = Column(Float)
    unit         = Column(String)
    severity     = Column(String)
    ai_detected  = Column(Boolean, default=False)
    acknowledged = Column(Boolean, default=False)
    timestamp    = Column(DateTime, default=datetime.utcnow)


# ── Create all tables ───────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)


# ── Dependency for routes ───────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
import datetime

from sqlalchemy import Column, DateTime, Float, Integer, Text

from database import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plate = Column(Text, nullable=False)
    entry_time = Column(DateTime, nullable=False)
    exit_time = Column(DateTime, nullable=True)
    amount = Column(Float, nullable=True)
    rate_per_hour = Column(Float, nullable=False)
    status = Column(Text, default="open")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, Text

from database import Base


class Ticket(Base):
    """
    Ticket de estacionamiento.

    Valores posibles de `status`:
      - 'open'    : vehículo dentro, sin cobrar
      - 'waiting' : pagado, dentro del período de gracia de 10 min, sin salir físicamente
      - 'exited'  : pagado Y cámara confirmó salida física
      - 'abono'   : vehículo de abonado (rate_per_hour=0, amount=0)
      - 'paid'    : legacy — igual que 'exited' en consultas nuevas

    `amount` puede ser 0.0 para abonados.
    """

    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plate = Column(Text, nullable=False)
    entry_time = Column(DateTime, nullable=False)
    exit_time = Column(DateTime, nullable=True)
    amount = Column(Float, nullable=True, default=0.0)
    rate_per_hour = Column(Float, nullable=False)
    status = Column(Text, default="open")
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


class User(Base):
    """
    Usuario del sistema (cajero o administrador).

    Roles posibles:
      - 'admin'   : acceso total al panel de administración
      - 'cashier' : acceso a operaciones de entrada/salida
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(Text, nullable=False, default="cashier")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Abonado(Base):
    """
    Vehículo abonado (pase mensual o similar).
    Si `active=True` la entrada se registra sin cobro.
    """

    __tablename__ = "abonados"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plate = Column(Text, unique=True, nullable=False)
    name = Column(Text, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

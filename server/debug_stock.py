import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, text
from models.order import OrderItem
from models.inventory import InventoryItem
import inspect as insp

async def debug():
    engine = create_async_engine("sqlite+aiosqlite:///D:/New alumimem/server/udyana.db", connect_args={"check_same_thread": False})
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        # Check old order items
        result = await db.execute(select(OrderItem).where(OrderItem.order_id == 1))
        items = result.scalars().all()
        print(f"Order items count: {len(items)}")
        for item in items:
            print(f"  Item: name={item.product_name!r}, type={item.item_type!r}, w={item.width!r}, h={item.height!r}, l={item.length!r}, q={item.quantity!r}, c={item.color!r}, s={item.size!r}, g={item.gaze!r}")
            print(f"    types: width={type(item.width).__name__}, height={type(item.height).__name__}, length={type(item.length).__name__}, quantity={type(item.quantity).__name__}")
        
        # Check inventory
        result2 = await db.execute(select(InventoryItem))
        invs = result2.scalars().all()
        print(f"\nInventory items count: {len(invs)}")
        for inv in invs:
            print(f"  Inv: name={inv.name!r}, pricing={inv.pricing_mode!r}, stock={inv.current_stock!r}, item_type={inv.item_type!r}, w={inv.width_ft!r}, h={inv.height_ft!r}, l={inv.length!r}")

asyncio.run(debug())

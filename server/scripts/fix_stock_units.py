"""One-time repair: switch legacy inventory rows to piece-based stock.

Existing rows were stocked by dimension (length x qty / width x height x qty)
while being priced per piece. Reset current_stock to the piece count (stock_qty)
and mark them as pricing_mode='piece'.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from database import async_session
from models.inventory import InventoryItem


async def main() -> None:
    async with async_session() as db:
        result = await db.execute(select(InventoryItem))
        items = result.scalars().all()
        fixed = 0
        for item in items:
            item.pricing_mode = "piece"
            if float(item.current_stock or 0) != float(item.stock_qty or 0):
                print(
                    f"  {item.name}: current_stock {item.current_stock} -> {item.stock_qty} (pricing_mode=piece)"
                )
                item.current_stock = item.stock_qty or 0
                fixed += 1
        await db.commit()
        print(f"Done. Fixed {fixed} item(s) out of {len(items)}.")


if __name__ == "__main__":
    asyncio.run(main())

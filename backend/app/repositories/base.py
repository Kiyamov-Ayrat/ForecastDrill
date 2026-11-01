from typing import Generic, TypeVar
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class BaseRepository(Generic[T]):
    model: type[T]

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, id_):
        return await self.session.get(self.model, id_)

    async def save(self, entity: T) -> T:     # единая точка сохранения (аналог SaveChanges)
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity
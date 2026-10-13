export function createCategoryController({ categoryService }) {
  return {
    async list(req, res) {
      res.json({ data: await categoryService.list(req.user.id, req.validated.query) });
    },
    async create(req, res) {
      res.status(201).json({ data: await categoryService.create(req.user.id, req.validated.body) });
    },
    async update(req, res) {
      const { id } = req.validated.params;
      res.json({ data: await categoryService.update(req.user.id, id, req.validated.body) });
    },
    async remove(req, res) {
      await categoryService.remove(req.user.id, req.validated.params.id);
      res.status(204).end();
    },
  };
}

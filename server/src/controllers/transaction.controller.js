import { exportFileName, toCsv, toXlsxBuffer } from '../services/export.service.js';

export function createTransactionController({ transactionService, categoryService }) {
  return {
    async list(req, res) {
      res.json(await transactionService.list(req.user.id, req.validated.query));
    },
    async getById(req, res) {
      res.json({ data: await transactionService.getById(req.user.id, req.validated.params.id) });
    },
    async create(req, res) {
      res.status(201).json({ data: await transactionService.create(req.user.id, req.validated.body) });
    },
    async update(req, res) {
      const { id } = req.validated.params;
      res.json({ data: await transactionService.update(req.user.id, id, req.validated.body) });
    },
    async remove(req, res) {
      await transactionService.remove(req.user.id, req.validated.params.id);
      res.status(204).end();
    },

    // GET /api/transactions/export?format=csv|xlsx&<same filters as the list>
    async exportFile(req, res) {
      const { format, ...filters } = req.validated.query;
      const { rows, summary } = await transactionService.listForExport(req.user.id, filters);

      res.attachment(exportFileName(format)); // sets Content-Disposition: attachment; filename=...
      if (format === 'csv') {
        res.type('text/csv; charset=utf-8').send(toCsv(rows));
        return;
      }

      // Show the category name (not its id) in the Excel summary sheet
      let categoryName;
      if (filters.categoryId) {
        const categories = await categoryService.list(req.user.id);
        categoryName = categories.find((c) => c.id === filters.categoryId)?.name;
      }
      const buffer = await toXlsxBuffer(rows, { summary, filters: { ...filters, categoryName } });
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(Buffer.from(buffer));
    },
  };
}

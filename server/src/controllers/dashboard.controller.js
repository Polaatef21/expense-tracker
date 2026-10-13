export function createDashboardController({ dashboardService }) {
  return {
    async summary(req, res) {
      res.json(await dashboardService.summary(req.user.id, req.validated.query));
    },
  };
}

// Controllers translate HTTP <-> service calls. Inputs come from req.validated
// (already checked by the validate middleware); the user id from req.user (JWT).
export function createAuthController({ authService }) {
  return {
    async register(req, res) {
      res.status(201).json(await authService.register(req.validated.body));
    },
    async login(req, res) {
      res.json(await authService.login(req.validated.body));
    },
    async me(req, res) {
      res.json({ user: await authService.getUser(req.user.id) });
    },
  };
}

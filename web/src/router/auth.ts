import express from "express";
import jwt from "jsonwebtoken";

export const requireAuth = (req: any, res: any, next: any) => {
  const token = req.cookies?.token;
  if (!token) return res.redirect("/login");

  try {
    req.user = jwt.verify(token, "super-secret-key");
    return next();
  } catch (err) {
    return res.redirect("/login");
  }
};

export function buildAuthRouter() {
  const router = express.Router();

  router.get("/login", (req, res) => {
    const mode = req.query.mode === "register" ? "register" : "login";
    res.render("login", {
      title: "Login",
      activePage: "login",
      error: null,
      mode,
    });
  });

  router.post("/login", async (req, res) => {
    try {
      const r = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userOrEmail: req.body.userOrEmail,
          password: req.body.password,
        }),
      });

      const data = await r.json();
      if (!data.ok) {
        return res.render("login", {
          title: "Login",
          activePage: "login",
          error: data.error || "Login failed",
          mode: "login",
        });
      }

      res.cookie("token", data.token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax"
      });

      return res.redirect("/");
    } catch (e) {
      return res.render("login", {
        title: "Login",
        activePage: "login",
        error: "Server Error",
        mode: "login",
      });
    }
  });

  router.post("/register", async (req, res) => {
    try {
      const r = await fetch("http://localhost:3001/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: req.body.username,
          email: req.body.email,
          password: req.body.password,
        }),
      });

      const data = await r.json();
      if (!data.ok) {
        return res.render("login", {
          title: "Login",
          activePage: "login",
          error: data.error || "Sign Up failed",
          mode: "register",
        });
      }

      res.cookie("token", data.token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax"
      });

      return res.redirect("/");
    } catch (e) {
      return res.render("login", {
        title: "Login",
        activePage: "login",
        error: "Server Error",
        mode: "register",
      });
    }
  });

  router.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
  });

  return router;
}

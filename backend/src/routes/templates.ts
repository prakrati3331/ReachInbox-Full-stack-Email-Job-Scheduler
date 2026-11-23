import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

templatesRouter.get("/", async (req, res) => {
  const templates = await prisma.template.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ templates });
});

templatesRouter.post("/", async (req, res) => {
  const { name, subject, body } = req.body ?? {};
  if (!name?.trim() || !subject?.trim() || !body?.trim()) {
    return res.status(400).json({ error: "name_subject_body_required" });
  }
  const template = await prisma.template.create({
    data: {
      userId: req.userId!,
      name: name.trim(),
      subject: subject.trim(),
      body,
    },
  });
  res.status(201).json({ template });
});

templatesRouter.delete("/:id", async (req, res) => {
  const { count } = await prisma.template.deleteMany({
    where: { id: req.params.id, userId: req.userId },
  });
  if (count === 0) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { ok } from "../lib/response.js";
import {
  listPendingProposals,
  getProposal,
  getProposalAudit,
  approveProposal,
  rejectProposal,
} from "../services/ai-order-proposal.service.js";

const r = Router();
r.use(authenticate);

r.get("/pending", async (req, res, next) => {
  try { ok(res, await listPendingProposals(req.user.businessId)); } catch (error) { next(error); }
});

r.get("/:id", async (req, res, next) => {
  try { ok(res, await getProposal(req.user.businessId, req.params.id)); } catch (error) { next(error); }
});

r.get("/:id/audit", async (req, res, next) => {
  try { ok(res, await getProposalAudit(req.user.businessId, req.params.id)); } catch (error) { next(error); }
});

r.post("/:id/approve", async (req, res, next) => {
  try {
    ok(res, await approveProposal({
      businessId: req.user.businessId,
      proposalId: req.params.id,
      reviewerId: req.user.id,
    }), "Proposal approved");
  } catch (error) { next(error); }
});

r.post("/:id/reject", async (req, res, next) => {
  try {
    const { rejectionReason } = z.object({
      rejectionReason: z.string().trim().min(1).max(500),
    }).parse(req.body);
    ok(res, await rejectProposal({
      businessId: req.user.businessId,
      proposalId: req.params.id,
      reviewerId: req.user.id,
      rejectionReason,
    }), "Proposal rejected");
  } catch (error) { next(error); }
});

export default r;

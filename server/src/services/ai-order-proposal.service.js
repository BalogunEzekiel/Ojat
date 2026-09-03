import { prisma } from "../lib/prisma.js";
import { approveOrder } from "./order.service.js";

const proposalInclude = {
  customer: true,
  matchedProduct: { include: { inventory: true } },
  order: { include: { items: { include: { product: true } } } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
};

export async function listPendingProposals(businessId) {
  return prisma.aIOrderProposal.findMany({
    where: { businessId, status: "PENDING" },
    include: proposalInclude,
    orderBy: { createdAt: "asc" },
  });
}

export async function getProposal(businessId, proposalId) {
  const proposal = await prisma.aIOrderProposal.findFirst({
    where: { id: proposalId, businessId },
    include: proposalInclude,
  });
  if (!proposal) throw new Error("AI order proposal not found");
  return proposal;
}

export async function getProposalAudit(businessId, proposalId) {
  await getProposal(businessId, proposalId);
  return prisma.auditLog.findMany({
    where: { businessId, resource: "AI_ORDER_PROPOSAL", resourceId: proposalId },
    orderBy: { createdAt: "asc" },
  });
}

export async function approveProposal({ businessId, proposalId, reviewerId }) {
  const proposal = await getProposal(businessId, proposalId);
  if (proposal.status !== "PENDING") throw new Error(`Proposal cannot be approved. Current status: ${proposal.status}`);

  const order = await approveOrder(businessId, proposal.orderId);
  const updated = await prisma.aIOrderProposal.update({
    where: { id: proposalId },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: reviewerId },
    include: proposalInclude,
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorId: reviewerId,
      action: "ORDER_APPROVED",
      resource: "AI_ORDER_PROPOSAL",
      resourceId: proposalId,
      before: { status: proposal.status },
      after: { status: updated.status, orderId: order.id },
    },
  });
  return updated;
}

export async function rejectProposal({ businessId, proposalId, reviewerId, rejectionReason }) {
  const proposal = await getProposal(businessId, proposalId);
  if (proposal.status !== "PENDING") throw new Error(`Proposal cannot be rejected. Current status: ${proposal.status}`);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.aIOrderProposal.update({
      where: { id: proposalId },
      data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: reviewerId, rejectionReason },
      include: proposalInclude,
    });
    await tx.order.update({ where: { id: proposal.orderId }, data: { status: "CANCELLED" } });
    await tx.auditLog.create({
      data: {
        businessId,
        actorId: reviewerId,
        action: "ORDER_REJECTED",
        resource: "AI_ORDER_PROPOSAL",
        resourceId: proposalId,
        before: { status: proposal.status },
        after: { status: result.status, rejectionReason },
      },
    });
    return result;
  });
  return updated;
}

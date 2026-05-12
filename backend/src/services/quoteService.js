const Quote = require("../models/Quote");

// ── Role helpers ──────────────────────────────────────────────────────────────
const MANAGER_UP = ["sales_manager", "executive", "admin", "super_admin"];
const ADMIN_ROLES = ["admin", "super_admin"];

function resolveOwnerId(quote) {
  // After populate ownerId is an object, before populate it's a plain ObjectId
  return quote.ownerId?._id
    ? quote.ownerId._id.toString()
    : quote.ownerId.toString();
}

// ── List quotes (role-scoped) ─────────────────────────────────────────────────
async function listQuotes(user, query = {}) {
  const filter = {};

  // Sales reps see only their own quotes; managers and above see all
  if (user.role === "sales_rep") {
    filter.ownerId = user._id;
  }

  if (query.status) filter.status = query.status;
  if (query.clientName) {
    filter.clientName = { $regex: query.clientName, $options: "i" };
  }
  if (query.productLineId) {
    filter.activeProductLineIds = query.productLineId;
  }
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      // Include the full day by advancing to end-of-day
      const end = new Date(query.dateTo);
      end.setUTCHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, parseInt(query.limit, 10) || 20);
  const skip = (page - 1) * limit;

  const [quotes, total] = await Promise.all([
    Quote.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("ownerId", "firstName lastName email")
      .populate("activeProductLineIds", "name displayColor"),
    Quote.countDocuments(filter),
  ]);

  return { quotes, total, page, limit };
}

// ── Get single quote ──────────────────────────────────────────────────────────
async function getQuote(id, user) {
  const quote = await Quote.findById(id)
    .populate("ownerId", "firstName lastName email")
    .populate("activeProductLineIds", "name displayColor");

  if (!quote) return null;

  const isOwner = resolveOwnerId(quote) === user._id.toString();
  const canView = MANAGER_UP.includes(user.role) || isOwner;
  return canView ? quote : null;
}

// ── Create quote ──────────────────────────────────────────────────────────────
async function createQuote(data, user) {
  const quote = new Quote({
    ...data,
    ownerId: user._id,
    status: "Draft",
  });
  await quote.save();
  return quote;
}

// ── Update quote ──────────────────────────────────────────────────────────────
async function updateQuote(id, data, user) {
  const quote = await Quote.findById(id);
  if (!quote) return null;

  const isOwner = quote.ownerId.toString() === user._id.toString();
  const isAdmin = ADMIN_ROLES.includes(user.role);

  if (!isOwner && !isAdmin) return { forbidden: true };
  if (!isAdmin && quote.status !== "Draft") {
    return { badRequest: "Only Draft quotes can be edited" };
  }

  // Prevent callers from reassigning ownership
  const { ownerId: _discard, ...safeData } = data;
  Object.assign(quote, safeData);
  await quote.save();
  return quote;
}

// ── Delete quote ──────────────────────────────────────────────────────────────
async function deleteQuote(id, user) {
  const quote = await Quote.findById(id);
  if (!quote) return null;

  const isOwner = quote.ownerId.toString() === user._id.toString();
  const isAdmin = ADMIN_ROLES.includes(user.role);

  if (!isOwner && !isAdmin) return { forbidden: true };

  await Quote.findByIdAndDelete(id);
  return { deleted: true };
}

// ── Duplicate quote ───────────────────────────────────────────────────────────
async function duplicateQuote(id, user) {
  const original = await Quote.findById(id).lean();
  if (!original) return null;

  const isOwner = original.ownerId.toString() === user._id.toString();
  const canAccess = MANAGER_UP.includes(user.role) || isOwner;
  if (!canAccess) return { forbidden: true };

  const { _id, createdAt, updatedAt, __v, ...fields } = original;
  const copy = new Quote({
    ...fields,
    clientName: `Copy of ${original.clientName}`,
    status: "Draft",
    ownerId: user._id,
    approvedBy: null,
    approvalComment: "",
  });

  await copy.save();
  return copy;
}

// ── Dashboard stats (FR-DASH-3) ───────────────────────────────────────────────
async function getQuoteStats(user) {
  const matchStage = {};
  if (user.role === "sales_rep") {
    matchStage.ownerId = user._id;
  }

  const [totals, byLineCount, byLineTCV] = await Promise.all([
    // Total quotes and total pipeline
    Quote.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalQuotes: { $sum: 1 },
          totalPipeline: { $sum: "$netTCV" },
        },
      },
    ]),

    // Quote count per product line
    Quote.aggregate([
      { $match: matchStage },
      {
        $unwind: {
          path: "$activeProductLineIds",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: "productlines",
          localField: "activeProductLineIds",
          foreignField: "_id",
          as: "line",
        },
      },
      { $unwind: "$line" },
      {
        $group: {
          _id: "$line._id",
          name: { $first: "$line.name" },
          displayColor: { $first: "$line.displayColor" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),

    // Net TCV per product line
    Quote.aggregate([
      { $match: matchStage },
      {
        $unwind: {
          path: "$activeProductLineIds",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: "productlines",
          localField: "activeProductLineIds",
          foreignField: "_id",
          as: "line",
        },
      },
      { $unwind: "$line" },
      {
        $group: {
          _id: "$line._id",
          name: { $first: "$line.name" },
          displayColor: { $first: "$line.displayColor" },
          totalTCV: { $sum: "$netTCV" },
        },
      },
      { $sort: { totalTCV: -1 } },
    ]),
  ]);

  return {
    totalQuotes: totals[0]?.totalQuotes ?? 0,
    totalPipeline: totals[0]?.totalPipeline ?? 0,
    byLineCount,
    byLineTCV,
  };
}

module.exports = {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  duplicateQuote,
  getQuoteStats,
};

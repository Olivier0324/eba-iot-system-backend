export const buildQuery = (query) => {
    const { type, startDate, endDate } = query;

    let filter = {};

    // ================= TIME FILTER =================
    if (type === "weekly") {
        const now = new Date();
        const lastWeek = new Date();
        lastWeek.setDate(now.getDate() - 7);

        filter.timestamp = { $gte: lastWeek, $lte: now };
    }

    if (type === "monthly") {
        const now = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(now.getMonth() - 1);

        filter.timestamp = { $gte: lastMonth, $lte: now };
    }

    if (startDate && endDate) {
        filter.timestamp = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    return filter;
};
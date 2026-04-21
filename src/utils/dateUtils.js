/**
 * Shared utility for parsing dates from the backend.
 * Handles standard dates and the custom format: "MM/DD/YYYY HH:MM:SS AM/PM [Offset]"
 */
export const parseDate = (dateStr) => {
    if (!dateStr) return new Date(NaN);

    // Try standard parsing first
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;

    try {
        // Handle "MM/DD/YYYY HH:MM:SS AM/PM [Offset]"
        // Example: "12/27/2025 5:50:04 AM +00:00"
        const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})\s+(AM|PM)\s+([+-]\d{2}:\d{2}|Z)?/i);

        if (match) {
            let [_, m, d, y, h, min, s, ampm, offset] = match;
            m = parseInt(m, 10);
            d = parseInt(d, 10);
            y = parseInt(y, 10);
            h = parseInt(h, 10);
            min = parseInt(min, 10);
            s = parseInt(s, 10);

            if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
            if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;

            // Construct ISO string: YYYY-MM-DDTHH:MM:SS
            const isoBase = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

            if (offset) {
                if (offset.toUpperCase() === 'Z') offset = '+00:00';
                date = new Date(isoBase + offset);
            } else {
                // Fallback to local time
                date = new Date(y, m - 1, d, h, min, s);
            }
            return date;
        }
    } catch (e) {
        console.warn('parseDate regex failed:', e);
    }
    return new Date(NaN);
};

export const isPlanActive = (expiryDateStr) => {
    if (!expiryDateStr) return false;
    const expiry = parseDate(expiryDateStr);
    const now = new Date();
    return !isNaN(expiry.getTime()) && expiry > now;
};

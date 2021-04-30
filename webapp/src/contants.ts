export const cardScale = 0.5;
export const flipZoom = cardScale * 1.2;
export const cardWidth = 140 * cardScale;
export const cardHeight = 190 * cardScale;
export const margin = cardWidth * 0.1;
export const boardMargin = 20 + 75;
export const rows = 4;
export const columns = 3;
export const canvasWidth = (cardWidth * columns) + (boardMargin * 2) + (margin * (columns - 1));
export const canvasHeight = (cardHeight * rows) + (boardMargin * 2) + (margin * (rows - 1));


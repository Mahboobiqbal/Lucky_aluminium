import { jsPDF } from "jspdf";
import logoDataUrl from "@/assets/logo1.png?inline";

export const APP_LOGO_URL = logoDataUrl;

export function addAppLogoToPdf(doc: jsPDF, x: number, y: number, width: number, height: number) {
  try {
    doc.addImage(logoDataUrl, "PNG", x, y, width, height, undefined, "FAST");
    return true;
  } catch {
    return false;
  }
}

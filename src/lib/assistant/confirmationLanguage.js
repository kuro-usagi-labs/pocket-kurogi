// Full-message matches only. Never interpret negation, edits or new amounts as consent.
export const CONFIRMATION_PATTERN = /^(?:(?:ya|iya|yup|betul|benar|oke|ok|sip|setuju|konfirmasi|lanjut|gas)(?:\s+(?:boleh|catat|konfirmasi|setujui|lanjut(?:kan)?|saja|aja|sekarang|benar|betul|kok))*|(?:catat|simpan|rekam)\s+semua(?:nya)?)(?:[.!])?$/iu

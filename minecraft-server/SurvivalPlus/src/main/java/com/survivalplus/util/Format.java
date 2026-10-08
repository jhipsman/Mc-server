package com.survivalplus.util;

import java.util.Locale;

public final class Format {

    private Format() {
    }

    /** 5 -> "5", 2.5 -> "2.5", 1234.0 -> "1,234". */
    public static String number(double value) {
        if (Math.abs(value - Math.rint(value)) < 0.05) {
            return String.format(Locale.US, "%,d", Math.round(value));
        }
        return String.format(Locale.US, "%,.1f", value);
    }

    /** 93784 -> "1d 2h 3m". */
    public static String duration(long seconds) {
        long days = seconds / 86_400;
        long hours = (seconds % 86_400) / 3_600;
        long minutes = (seconds % 3_600) / 60;
        StringBuilder sb = new StringBuilder();
        if (days > 0) sb.append(days).append("d ");
        if (days > 0 || hours > 0) sb.append(hours).append("h ");
        sb.append(minutes).append('m');
        return sb.toString();
    }

    public static String roman(int n) {
        return switch (n) {
            case 1 -> "I";
            case 2 -> "II";
            case 3 -> "III";
            case 4 -> "IV";
            case 5 -> "V";
            default -> String.valueOf(n);
        };
    }

    /** Text progress bar, e.g. §a■■■■§7■■■■■■ */
    public static String bar(double fraction, int width) {
        int filled = (int) Math.round(Math.max(0, Math.min(1, fraction)) * width);
        return "§a" + "■".repeat(filled) + "§7" + "■".repeat(width - filled);
    }
}

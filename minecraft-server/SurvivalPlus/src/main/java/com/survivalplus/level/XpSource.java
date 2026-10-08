package com.survivalplus.level;

public enum XpSource {
    MINING("Mining"),
    FARMING("Farming"),
    COMBAT("Combat"),
    FISHING("Fishing"),
    ADMIN("Admin");

    private final String displayName;

    XpSource(String displayName) {
        this.displayName = displayName;
    }

    public String displayName() {
        return displayName;
    }
}

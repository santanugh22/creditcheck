import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CloseIcon,
  PlusIcon,
  RupeeIcon,
  SearchIcon,
  WalletIcon,
} from "../components/icons/LedgerIcons";
import { LoanEntryCard } from "../components/ledger/LoanEntryCard";
import {
  SkeletonLoaderCard,
  SpringPressable,
} from "../components/ui/AnimatedComponents";
import { SummaryHeroCard } from "../components/ui/SummaryHeroCard";
import { useAuthStore } from "../store/useAuthStore";
import { selectFilteredLoans, useLedgerStore } from "../store/useLedgerStore";
import { useTheme } from "../theme/ThemeContext";
import { formatINR, Radius, Spacing, Typography } from "../theme/tokens";
import {
  LoanEntry,
  LoanFilterStatus,
  SupportedLanguage,
} from "../types/ledger";
import { AddLoanModal } from "./AddLoanModal";
import { LoanDetailModal } from "./LoanDetailModal";

export function DashboardScreen() {
  const { colors, isDarkMode, setThemeMode } = useTheme();
  const { t, i18n } = useTranslation();

  const { user, updateUserProfile, logout } = useAuthStore();
  const {
    loans,
    summary,
    statusFilter,
    categoryFilter,
    searchQuery,
    isLoading,
    isRefreshing,
    error,
    fetchDashboard,
    fetchLoanDetail,
    repayLoanEntry,
    setStatusFilter,
    setSearchQuery,
    selectedLoan,
    setSelectedLoan,
    resetLedger,
  } = useLedgerStore();

  const searchInputRef = useRef<TextInput>(null);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const filteredLoans = useMemo(
    () => selectFilteredLoans(loans, statusFilter, categoryFilter, searchQuery),
    [loans, statusFilter, categoryFilter, searchQuery],
  );

  const currentLang = (
    i18n.language === "hi" ? "hi" : "en"
  ) as SupportedLanguage;

  const handleToggleLanguage = async () => {
    const nextLang: SupportedLanguage = currentLang === "en" ? "hi" : "en";
    await updateUserProfile({ preferredLanguage: nextLang });
  };

  const handleLogout = async () => {
    resetLedger();
    await logout();
  };

  const handleOpenLoanDetail = async (loan: LoanEntry) => {
    setSelectedLoan(loan);
    try {
      await fetchLoanDetail(loan.id);
    } catch (_e) {}
  };

  const handleQuickRepay = async (loan: LoanEntry) => {
    try {
      await repayLoanEntry(loan.id);
    } catch (_e) {}
  };

  const filterTabs: { key: LoanFilterStatus; label: string; count: number }[] =
    [
      {
        key: "ALL",
        label: t("dashboard.filterAll"),
        count: summary.counts.totalEntries,
      },
      {
        key: "OVERDUE",
        label: t("dashboard.filterOverdue"),
        count: summary.counts.overdueEntries,
      },
      {
        key: "PENDING",
        label: t("dashboard.filterPending"),
        count: summary.counts.activeEntries,
      },
      {
        key: "REPAID",
        label: t("dashboard.filterRepaid"),
        count: summary.counts.repaidEntries,
      },
    ];

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top", "left", "right"]}
    >
      {/* Top App Bar */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.brandRow}>
          <View style={[styles.logoBadge, { backgroundColor: colors.primary }]}>
            <RupeeIcon size={18} color="#FBBF24" />
          </View>
          <View>
            <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
              {t("common.appName")}
            </Text>
            <Text
              style={[styles.userGreeting, { color: colors.textSecondary }]}
            >
              {user?.displayName || user?.phone}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <SpringPressable
            onPress={handleToggleLanguage}
            style={[
              styles.actionChip,
              {
                backgroundColor: colors.primaryLight,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.actionChipText, { color: colors.primary }]}>
              {currentLang === "en" ? "हिन्दी" : "EN"}
            </Text>
          </SpringPressable>

          <SpringPressable
            onPress={() => setThemeMode(isDarkMode ? "light" : "dark")}
            style={[
              styles.actionChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={{ fontSize: 13 }}>{isDarkMode ? "☀️" : "🌙"}</Text>
          </SpringPressable>

          <SpringPressable
            onPress={handleLogout}
            style={[
              styles.actionChip,
              {
                backgroundColor: colors.dangerSurface,
                borderColor: colors.danger,
              },
            ]}
          >
            <Text style={[styles.actionChipText, { color: colors.danger }]}>
              ⎋
            </Text>
          </SpringPressable>
        </View>
      </View>

      {/* Main Ledger List */}
      <FlatList
        data={filteredLoans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchDashboard(true)}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Top Summary Card */}
            <SummaryHeroCard
              summary={summary}
              onPressOverdueFilter={() =>
                setStatusFilter(statusFilter === "OVERDUE" ? "ALL" : "OVERDUE")
              }
            />

            {/* Friend-Wise Outstanding Strip */}
            {summary.friendBreakdown.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.friendStrip}
              >
                {summary.friendBreakdown.map((friend) => (
                  <SpringPressable
                    key={friend.friendName}
                    onPress={() =>
                      setSearchQuery(
                        searchQuery === friend.friendName
                          ? ""
                          : friend.friendName,
                      )
                    }
                    style={[
                      styles.friendPill,
                      {
                        backgroundColor:
                          searchQuery === friend.friendName
                            ? colors.primaryLight
                            : colors.surface,
                        borderColor:
                          friend.overdueAmount > 0
                            ? colors.danger
                            : searchQuery === friend.friendName
                              ? colors.primary
                              : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.friendPillName,
                        { color: colors.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {friend.friendName}
                    </Text>
                    <Text
                      style={[
                        styles.friendPillAmount,
                        {
                          color:
                            friend.overdueAmount > 0
                              ? colors.danger
                              : colors.primary,
                        },
                      ]}
                    >
                      {formatINR(friend.outstandingAmount)}
                    </Text>
                  </SpringPressable>
                ))}
              </ScrollView>
            )}

            {/* Search Input Bar */}
            <Pressable
              onPress={() => searchInputRef.current?.focus()}
              style={[
                styles.searchBar,
                {
                  backgroundColor: colors.surface,
                  borderColor: isSearchFocused ? colors.primary : colors.border,
                },
              ]}
            >
              <Pressable
                onPress={() => searchInputRef.current?.focus()}
                style={styles.searchIconBox}
              >
                <SearchIcon
                  size={19}
                  color={isSearchFocused ? colors.primary : colors.textMuted}
                />
              </Pressable>
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder={t("common.search")}
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                style={[styles.searchInput, { color: colors.textPrimary }]}
              />
              <View
                pointerEvents={searchQuery.length > 0 ? "auto" : "none"}
                style={[
                  styles.searchClearWrapper,
                  { opacity: searchQuery.length > 0 ? 1 : 0 },
                ]}
              >
                <SpringPressable
                  onPress={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[
                    styles.searchClearBtn,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <CloseIcon size={12} color={colors.textSecondary} />
                </SpringPressable>
              </View>
            </Pressable>

            {/* Active Search Result Pill */}
            {searchQuery.trim().length > 0 && (
              <View
                style={[
                  styles.searchActiveBar,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <Text
                  style={[
                    styles.searchActiveText,
                    { color: colors.primary },
                  ]}
                >
                  {filteredLoans.length === 1
                    ? `Found 1 entry for "${searchQuery.trim()}"`
                    : `Found ${filteredLoans.length} entries for "${searchQuery.trim()}"`}
                </Text>
                <SpringPressable
                  onPress={() => setSearchQuery("")}
                  style={styles.searchResetBtn}
                >
                  <Text
                    style={[
                      styles.searchResetText,
                      { color: colors.primary },
                    ]}
                  >
                    Clear
                  </Text>
                </SpringPressable>
              </View>
            )}

            {/* Filter Tabs (All / Overdue / Active / Settled) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterTabsRow}
            >
              {filterTabs.map((tab) => {
                const isActive = statusFilter === tab.key;
                const isOverdueTab = tab.key === "OVERDUE";

                const activeBg = isOverdueTab ? colors.danger : colors.primary;

                return (
                  <SpringPressable
                    key={tab.key}
                    onPress={() => setStatusFilter(tab.key)}
                    style={[
                      styles.filterTab,
                      {
                        backgroundColor: isActive ? activeBg : colors.surface,
                        borderColor: isActive
                          ? activeBg
                          : isOverdueTab && tab.count > 0
                            ? colors.danger
                            : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterTabText,
                        {
                          color: isActive
                            ? "#FFFFFF"
                            : isOverdueTab && tab.count > 0
                              ? colors.danger
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {tab.label} ({tab.count})
                    </Text>
                  </SpringPressable>
                );
              })}
            </ScrollView>

            {error && (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: colors.dangerSurface,
                    borderColor: colors.danger,
                  },
                ]}
              >
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {error}
                </Text>
              </View>
            )}

            {isLoading && (
              <View style={{ marginTop: Spacing.sm }}>
                <SkeletonLoaderCard />
                <SkeletonLoaderCard />
                <SkeletonLoaderCard />
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <LoanEntryCard
            loan={item}
            index={index}
            onPress={handleOpenLoanDetail}
            onQuickRepay={handleQuickRepay}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View
              style={[
                styles.emptyContainer,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {searchQuery.trim().length > 0 ? (
                <>
                  <SearchIcon size={38} color={colors.textMuted} />
                  <Text
                    style={[styles.emptyTitle, { color: colors.textPrimary }]}
                  >
                    No matching entries
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    No records found for "{searchQuery.trim()}". Try checking the name, note, or category spelling.
                  </Text>
                  <SpringPressable
                    onPress={() => setSearchQuery("")}
                    style={[
                      styles.emptyClearBtn,
                      {
                        backgroundColor: colors.primaryLight,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontWeight: "700",
                        fontSize: Typography.fontSizes.xs,
                      }}
                    >
                      Clear Search Filter
                    </Text>
                  </SpringPressable>
                </>
              ) : (
                <>
                  <WalletIcon size={42} color={colors.primary} />
                  <Text
                    style={[styles.emptyTitle, { color: colors.textPrimary }]}
                  >
                    {t("dashboard.emptyTitle")}
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t("dashboard.emptySubtitle")}
                  </Text>
                </>
              )}
            </View>
          ) : undefined
        }
      />

      {/* Floating Action Button (+ Add Udhaar Entry) */}
      <View style={styles.fabContainer}>
        <SpringPressable
          hapticStyle="medium"
          onPress={() => setIsAddModalVisible(true)}
          style={[styles.fabButton, { backgroundColor: colors.primary }]}
        >
          <PlusIcon size={20} color="#FFFFFF" />
          <Text style={styles.fabText}>{t("dashboard.addLoanButton")}</Text>
        </SpringPressable>
      </View>

      {/* Modals */}
      <AddLoanModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
      />

      <LoanDetailModal
        loan={selectedLoan}
        visible={Boolean(selectedLoan)}
        onClose={() => setSelectedLoan(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm + 2,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
  },
  userGreeting: {
    fontSize: Typography.fontSizes.xs,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs + 2,
  },
  actionChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  actionChipText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 110,
  },
  friendStrip: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  friendPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    minWidth: 110,
  },
  friendPillName: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
  },
  friendPillAmount: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    paddingHorizontal: Spacing.md + 2,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
  },
  searchIconBox: {
    marginRight: Spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    alignSelf: "stretch",
    fontSize: Typography.fontSizes.sm,
    fontWeight: "500",
    includeFontPadding: false,
    textAlignVertical: "center",
    paddingVertical: 0,
    paddingHorizontal: Spacing.xs,
  },
  searchClearWrapper: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: Spacing.xs,
  },
  searchClearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  searchActiveBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  searchActiveText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    flex: 1,
  },
  searchResetBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  searchResetText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  emptyClearBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterTabsRow: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
  },
  emptyContainer: {
    alignItems: "center",
    padding: Spacing.xxl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: Typography.fontSizes.sm,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  fabContainer: {
    position: "absolute",
    bottom: Spacing.xl,
    right: Spacing.lg,
    left: Spacing.lg,
    alignItems: "center",
  },
  fabButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 15,
    borderRadius: Radius.full,
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
});

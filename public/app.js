(() => {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const randomDelta = (range) =>
    Math.floor(Math.random() * (range * 2 + 1)) - range;
  const randomInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const formatCount = (value) => `${value.toLocaleString("en-US")} online`;
  const formatDuration = (seconds) => {
    const safe = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(safe / 60);
    const rem = safe % 60;
    if (minutes <= 0) return `${rem}s`;
    return `${minutes}m ${rem.toString().padStart(2, "0")}s`;
  };

  const formatStatValue = (value, format) => {
    if (format === "duration") {
      return formatDuration(value);
    }
    return value.toLocaleString("en-US");
  };

  const initLiveIndicator = () => {
    const indicator = document.querySelector("[data-live-indicator]");
    if (!indicator) return;

    const label = indicator.querySelector(".status-label");
    if (!label) return;

    const base = Number(indicator.dataset.liveBase) || 3820;
    const variance = Number(indicator.dataset.liveVariance) || 90;
    const stepRange = Math.max(2, Math.round(variance * 0.2));

    let current = Number(indicator.dataset.liveCount) || base;

    const updateLabel = () => {
      label.textContent = formatCount(current);
    };

    const tick = () => {
      const next = current + randomDelta(stepRange);
      current = clamp(next, base - variance, base + variance);
      updateLabel();
    };

    updateLabel();
    setInterval(tick, 7000 + Math.floor(Math.random() * 4000));
  };

  const initMetricCards = () => {
    const cards = document.querySelectorAll("[data-stat-card]");
    if (!cards.length) return;

    cards.forEach((card) => {
      const valueEl = card.querySelector("[data-stat-value]");
      if (!valueEl) return;

      const base = Number(card.dataset.statBase) || 0;
      const variance = Number(card.dataset.statVariance) || 0;
      const format = card.dataset.statFormat || "number";
      const stepRange = Math.max(1, Math.round(variance * 0.3));

      let current = Number(card.dataset.statValue) || base;

      const updateValue = () => {
        valueEl.textContent = formatStatValue(current, format);
      };

      const tick = () => {
        const next = current + randomDelta(stepRange);
        const min = Math.max(0, base - variance);
        const max = base + variance;
        current = clamp(next, min, max);
        card.dataset.statValue = current;
        updateValue();
      };

      updateValue();
      setInterval(tick, 8000 + Math.floor(Math.random() * 4000));
    });
  };

  const initAdminPresence = () => {
    const toggles = document.querySelectorAll("[data-admin-presence]");
    if (!toggles.length) return;

    toggles.forEach((toggle) => {
      let state = "active";
      let timer = null;
      const activeDuration =
        Number(toggle.dataset.activeDuration) || 20 * 60 * 1000;
      const offlineDuration =
        Number(toggle.dataset.offlineDuration) || 30 * 60 * 1000;

      const applyState = (nextState) => {
        state = nextState;
        const isActive = state === "active";
        toggle.classList.toggle("is-offline", !isActive);
        toggle.setAttribute("aria-pressed", isActive ? "true" : "false");
        toggle.textContent = isActive ? "Active" : "Offline";
      };

      const scheduleNext = () => {
        clearTimeout(timer);
        const delay = state === "active" ? activeDuration : offlineDuration;
        timer = setTimeout(() => {
          applyState(state === "active" ? "offline" : "active");
          scheduleNext();
        }, delay);
      };

      toggle.addEventListener("click", () => {
        applyState(state === "active" ? "offline" : "active");
        scheduleNext();
      });

      applyState("active");
      scheduleNext();
    });
  };

  const initSkeletonState = () => {
    const feed = document.querySelector("[data-feed]");
    if (!feed) return;
    const cards = feed.querySelector("[data-feed-cards]");
    document.body.classList.add("is-loading");
    const settle = () => {
      document.body.classList.remove("is-loading");
      document.body.classList.add("feed-ready");
      if (cards) {
        cards.setAttribute("aria-busy", "false");
      }
    };
    const delay = 500 + Math.floor(Math.random() * 1000);
    setTimeout(settle, delay);
  };

  const initFeedControls = () => {
    const feed = document.querySelector("[data-feed]");
    if (!feed) return;
    const list = feed.querySelector("[data-feed-cards]");
    if (!list) return;
    const cards = Array.from(list.querySelectorAll("[data-feed-card]"));
    if (!cards.length) return;

    const chips = feed.querySelectorAll("[data-feed-filter]");
    const statusEl = feed.querySelector("[data-feed-status]");
    const countEl = feed.querySelector("[data-feed-count]");
    const labelEl = feed.querySelector("[data-feed-label]");
    const defaultStatus = feed.querySelector("[data-feed-default]");
    const emptyStatus = feed.querySelector("[data-feed-empty]");
    const sortSelect = feed.querySelector("[data-feed-sort]");
    let activeFilter = "all";

    cards.forEach((card) => {
      card.hidden = false;
      card.classList.remove("is-hidden");
      card.setAttribute("aria-hidden", "false");
    });

    const updateStatus = (visible) => {
      if (visible === 0) {
        if (countEl) countEl.textContent = 0;
        if (defaultStatus) defaultStatus.hidden = true;
        if (emptyStatus) {
          emptyStatus.hidden = false;
        } else if (statusEl) {
          statusEl.textContent = "No updates match that filter.";
        }
        return;
      }

      if (countEl) {
        countEl.textContent = visible;
      }
      if (labelEl) {
        labelEl.textContent = visible === 1 ? "update" : "updates";
      } else if (statusEl) {
        statusEl.textContent = `Showing ${visible} update${
          visible === 1 ? "" : "s"
        }`;
      }
      if (defaultStatus) defaultStatus.hidden = false;
      if (emptyStatus) emptyStatus.hidden = true;
    };

    const hideCard = (card) => {
      if (card.hidden) return;
      card.classList.add("is-hidden");
      card.setAttribute("aria-hidden", "true");
      if (card.hideTimer) {
        clearTimeout(card.hideTimer);
      }
      card.hideTimer = setTimeout(() => {
        if (card.classList.contains("is-hidden")) {
          card.hidden = true;
        }
        card.hideTimer = null;
      }, 180);
    };

    const showCard = (card) => {
      if (card.hideTimer) {
        clearTimeout(card.hideTimer);
        card.hideTimer = null;
      }
      if (!card.hidden && !card.classList.contains("is-hidden")) {
        card.setAttribute("aria-hidden", "false");
        return;
      }
      card.hidden = false;
      card.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        card.classList.remove("is-hidden");
      });
    };

    const filterCards = (value) => {
      activeFilter = value;
      let visible = 0;
      cards.forEach((card) => {
        const tags = (card.dataset.tags || "")
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean);
        const match = value === "all" || tags.includes(value);
        if (match) {
          showCard(card);
          visible += 1;
        } else {
          hideCard(card);
        }
      });
      updateStatus(visible);
    };

    const applySort = (mode) => {
      const sorterMap = {
        trending: (a, b) =>
          (Number(b.dataset.likes) || 0) - (Number(a.dataset.likes) || 0),
        recent: (a, b) =>
          new Date(b.dataset.created || 0) - new Date(a.dataset.created || 0),
        chronological: (a, b) =>
          new Date(a.dataset.created || 0) - new Date(b.dataset.created || 0),
      };
      const sorter = sorterMap[mode] || sorterMap.trending;
      [...cards].sort(sorter).forEach((card) => list.appendChild(card));
    };

    if (chips.length) {
      chips.forEach((chip, index) => {
        chip.setAttribute("aria-pressed", index === 0 ? "true" : "false");
        chip.addEventListener("click", () => {
          const value = chip.dataset.feedFilter || "all";
          chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
          chip.setAttribute("aria-pressed", "true");
          filterCards(value);
        });
      });
    }

    if (sortSelect) {
      applySort(sortSelect.value);
      sortSelect.addEventListener("change", () => {
        applySort(sortSelect.value);
      });
    }

    filterCards(activeFilter);
  };

  const updateCountValue = (chip, nextValue) => {
    const countEl = chip.querySelector("[data-count-value]");
    const formatted = nextValue.toLocaleString("en-US");
    if (countEl) {
      countEl.textContent = formatted;
    } else {
      chip.lastElementChild.textContent = formatted;
    }
  };

  const initAdminLikeTicker = () => {
    const adminChips = document.querySelectorAll("[data-admin-like]");
    if (!adminChips.length) return;

    let current = Number(adminChips[0].dataset.count || 0);
    if (!Number.isFinite(current)) {
      current = 0;
    }

    const persona = {
      intervalMin: randomInt(180, 320) * 1000,
      intervalMax: randomInt(360, 780) * 1000,
      stepMin: 1,
      stepMax: 2,
      idleChance: randomInt(20, 45),
    };

    const intervalWindow = Math.max(
      1500,
      persona.intervalMax - persona.intervalMin
    );

    const syncCounts = () => {
      adminChips.forEach((chip) => {
        chip.dataset.count = current;
        updateCountValue(chip, current);
        const parentCard = chip.closest("[data-feed-card]");
        if (parentCard) {
          parentCard.dataset.likes = current;
        }
      });
    };

    const scheduleTick = () => {
      const nextDelay =
        persona.intervalMin + Math.floor(Math.random() * intervalWindow);
      setTimeout(() => {
        if (Math.random() * 100 < persona.idleChance) {
          scheduleTick();
          return;
        }
        const delta = randomInt(persona.stepMin, persona.stepMax);
        current += delta;
        syncCounts();
        scheduleTick();
      }, nextDelay);
    };

    scheduleTick();
  };

  const initActionChips = () => {
    const chips = document.querySelectorAll("[data-action]");
    if (!chips.length) return;
    chips.forEach((chip) => {
      if (chip.dataset.action === "like") {
        chip.dataset.liked = chip.dataset.liked || "false";
        chip.setAttribute("aria-pressed", "false");
      }
      chip.addEventListener("click", () => {
        const action = chip.dataset.action;
        if (action !== "like") {
          return;
        }

        if (chip.dataset.liked === "true") {
          return;
        }

        const baseCount = Number(chip.dataset.count || 0);
        const next = baseCount + 1;
        chip.dataset.count = next;
        chip.dataset.liked = "true";
        updateCountValue(chip, next);
        chip.classList.add("is-active");
        chip.disabled = true;
        chip.setAttribute("aria-pressed", "true");
        chip.setAttribute("title", "You liked this update");
        setTimeout(() => chip.classList.remove("is-active"), 600);
      });
    });
  };

  const initAutoLikeTimers = () => {
    const cards = document.querySelectorAll("[data-feed-card]");
    if (!cards.length) return;

    cards.forEach((card) => {
      const targetValue = Number(card.dataset.likeTarget);
      if (Number.isNaN(targetValue) || targetValue <= 0) return;
      const likeChip = card.querySelector('[data-action="like"]');
      if (!likeChip) return;

      let current = Number(likeChip.dataset.count || 0);
      if (current >= targetValue) return;

      const persona = {
        intervalMin:
          Number(card.dataset.likeIntervalMin) ||
          Number(likeChip.dataset.likeIntervalMin) ||
          120000,
        intervalMax:
          Number(card.dataset.likeIntervalMax) ||
          Number(likeChip.dataset.likeIntervalMax) ||
          420000,
        stepMin:
          Number(card.dataset.likeStepMin) ||
          Number(likeChip.dataset.likeStepMin) ||
          1,
        stepMax:
          Number(card.dataset.likeStepMax) ||
          Number(likeChip.dataset.likeStepMax) ||
          2,
        idleChance:
          Number(card.dataset.likeIdleChance) ||
          Number(likeChip.dataset.likeIdleChance) ||
          0,
      };

      if (persona.stepMax < persona.stepMin) {
        persona.stepMax = persona.stepMin;
      }

      const intervalWindow = Math.max(
        1500,
        persona.intervalMax - persona.intervalMin
      );

      const scheduleTick = () => {
        if (current >= targetValue) return;
        const delay =
          persona.intervalMin + Math.floor(Math.random() * intervalWindow);
        likeChip.autoLikeTimer = setTimeout(() => {
          if (current >= targetValue) {
            return;
          }
          if (Math.random() * 100 < persona.idleChance) {
            scheduleTick();
            return;
          }
          const remaining = targetValue - current;
          const delta = Math.min(
            remaining,
            randomInt(persona.stepMin, persona.stepMax)
          );
          current += delta;
          likeChip.dataset.count = current;
          card.dataset.likes = current;
          updateCountValue(likeChip, current);
          scheduleTick();
        }, delay);
      };

      scheduleTick();
    });
  };

  window.addEventListener("DOMContentLoaded", () => {
    initSkeletonState();
    initLiveIndicator();
    initMetricCards();
    initAdminPresence();
    initFeedControls();
    initActionChips();
    initAdminLikeTicker();
    initAutoLikeTimers();
  });
})();

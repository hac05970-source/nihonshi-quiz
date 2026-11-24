const eras = [...new Set(QUIZ_DATA.map((item) => item.era))];
const eraList = document.querySelector("#era-list");
const setup = document.querySelector("#setup");
const quiz = document.querySelector("#quiz");
const result = document.querySelector("#result");

let questions = [];
let currentIndex = 0;
let correctCount = 0;
let selectedMode = "year";
let timerId = null;
const QUESTION_SECONDS = 10;
const WRONG_STORAGE_KEY = "nihonshi-quiz-wrong-items";

function loadWrongItems() {
  try {
    const stored = JSON.parse(localStorage.getItem(WRONG_STORAGE_KEY) || "[]");
    const normalized = stored.map((key) => {
      if (typeof key !== "string") return null;
      const [year, eventName] = key.split("::");
      if (QUIZ_DATA.some((item) => itemKey(item) === key)) return key;
      const match = QUIZ_DATA.find((item) =>
        item.year === year &&
        (eventName?.startsWith(item.event) || item.event.startsWith(eventName || ""))
      );
      return match ? itemKey(match) : null;
    }).filter(Boolean);
    return [...new Set(normalized)];
  } catch {
    return [];
  }
}

function saveWrongItems(items) {
  localStorage.setItem(WRONG_STORAGE_KEY, JSON.stringify(items));
  updateWrongCount();
}

function updateWrongCount() {
  document.querySelector("#wrong-count").textContent = String(loadWrongItems().length);
}

function itemKey(item) {
  return `${item.year}::${item.event}`;
}

updateWrongCount();

for (const era of eras) {
  const label = document.createElement("label");
  label.innerHTML = `<input type="checkbox" value="${era}" checked><span>${era}</span>`;
  eraList.append(label);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getSelectedEras() {
  return [...eraList.querySelectorAll("input:checked")].map((input) => input.value);
}

function createChoices(question) {
  const pool = QUIZ_DATA.filter((item) => item.era === question.era);
  const field = question.mode === "year" ? "year" : "event";
  const candidates = shuffle(
    [...new Set(pool.filter((item) => item[field] !== question.answer).map((item) => item[field]))]
  ).slice(0, 3);
  return shuffle([question.answer, ...candidates]);
}

document.querySelector("#start-button").addEventListener("click", () => {
  const selectedEras = getSelectedEras();
  if (!selectedEras.length) {
    alert("出題する時代を1つ以上選択してください。");
    return;
  }
  selectedMode = document.querySelector('input[name="mode"]:checked').value;
  const courseMode = document.querySelector('input[name="course"]:checked').value;
  let pool = QUIZ_DATA.filter((item) => selectedEras.includes(item.era));
  if (courseMode === "review") {
    const wrongKeys = new Set(loadWrongItems());
    pool = pool.filter((item) => wrongKeys.has(itemKey(item)));
    if (!pool.length) {
      alert("選択した時代には、復習する間違えた問題がありません。");
      return;
    }
  }
  const selected = shuffle(pool).slice(0, Math.min(10, pool.length));

  questions = selected.map((item) => {
    let mode = selectedMode;
    if (selectedMode === "mix") mode = Math.random() < 0.5 ? "year" : "event";
    const answer = mode === "year" ? item.year : item.event;
    const question = mode === "year"
      ? `「${item.event}」は西暦何年の出来事ですか？`
      : `${item.year}年に起きた出来事はどれですか？`;
    return { mode, era: item.era, item, question, answer };
  });

  currentIndex = 0;
  correctCount = 0;
  document.querySelector("#score").textContent = "0";
  setup.hidden = true;
  result.hidden = true;
  quiz.hidden = false;
  renderQuestion();
});

function renderQuestion() {
  const question = questions[currentIndex];
  document.querySelector("#era-label").textContent = question.era;
  document.querySelector("#progress-label").textContent = `${currentIndex + 1} / ${questions.length}`;
  document.querySelector("#progress-bar").style.width = `${((currentIndex + 1) / questions.length) * 100}%`;
  document.querySelector("#question").textContent = question.question;
  startTimer();

  const choices = document.querySelector("#choices");
  choices.innerHTML = "";
  document.querySelector("#feedback").hidden = true;

  for (const choice of createChoices(question)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = choice + (question.mode === "year" ? "年" : "");
    button.addEventListener("click", () => answer(choice, button));
    choices.append(button);
  }
}

function startTimer() {
  if (timerId) clearInterval(timerId);
  const startedAt = Date.now();
  const timerLabel = document.querySelector("#timer-label");
  const timerBar = document.querySelector("#timer-bar");
  document.querySelector("#timer-label").textContent = `${QUESTION_SECONDS}秒`;
  document.querySelector("#timer-bar").style.width = "100%";

  timerId = setInterval(() => {
    const elapsed = (Date.now() - startedAt) / 1000;
    const remaining = Math.max(0, QUESTION_SECONDS - elapsed);
    timerLabel.textContent = remaining > 0 ? `${Math.ceil(remaining)}秒` : "0秒";
    timerBar.style.width = `${remaining / QUESTION_SECONDS * 100}%`;
    if (remaining <= 0) {
      clearInterval(timerId);
      timerId = null;
      answer(null, null);
    }
  }, 100);
}

function answer(choice, clickedButton) {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  const question = questions[currentIndex];
  const isCorrect = choice !== null && choice === question.answer;
  const key = itemKey(question.item);
  const wrongItems = loadWrongItems();
  if (isCorrect) {
    correctCount++;
    document.querySelector("#score").textContent = String(correctCount);
    if (wrongItems.includes(key)) {
      saveWrongItems(wrongItems.filter((wrongKey) => wrongKey !== key));
    }
  } else if (!wrongItems.includes(key)) {
    saveWrongItems([...wrongItems, key]);
  }

  document.querySelectorAll(".choice").forEach((button) => {
    button.disabled = true;
    const value = button.textContent.replace(/年$/, "");
    if (value === String(question.answer)) button.classList.add("correct");
  });
  if (!isCorrect && clickedButton) clickedButton.classList.add("wrong");

  const feedback = document.querySelector("#feedback");
  document.querySelector("#feedback-text").textContent =
    `${isCorrect ? "正解！" : choice === null ? "時間切れ！" : "不正解"}　正解：${question.answer}${question.mode === "year" ? "年" : ""}　${question.item.year}年「${question.item.event}」`;
  feedback.hidden = false;
  document.querySelector("#next-button").textContent =
    currentIndex === questions.length - 1 ? "結果を見る" : "次の問題";
}

document.querySelector("#next-button").addEventListener("click", () => {
  if (currentIndex === questions.length - 1) {
    showResult();
    return;
  }
  currentIndex++;
  renderQuestion();
});

function showResult() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  quiz.hidden = true;
  result.hidden = false;
  document.querySelector("#result-score").textContent = `${correctCount} / ${questions.length}`;
  const rate = correctCount / questions.length;
  document.querySelector("#result-message").textContent =
    rate === 1 ? "満点！完璧です。" : rate >= 0.7 ? "よくできました。復習を続けましょう。" : "もう一度、時代別に練習しましょう。";
}

document.querySelector("#retry-button").addEventListener("click", () => {
  document.querySelector("#start-button").click();
});
document.querySelector("#back-button").addEventListener("click", () => {
  result.hidden = true;
  setup.hidden = false;
});

document.querySelector("#clear-wrong-button").addEventListener("click", () => {
  if (!loadWrongItems().length) return;
  if (confirm("間違えた問題の復習履歴をすべて削除しますか？")) {
    saveWrongItems([]);
  }
});

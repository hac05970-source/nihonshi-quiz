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

const genreNames = {
  history: "歴史",
  geography: "地理",
  civics: "公民",
  current: "時事",
  mix: "総合学習",
};

const GENRE_DATA = {
  geography: typeof GEOGRAPHY_QUIZ_DATA !== "undefined" ? GEOGRAPHY_QUIZ_DATA : [],
  civics: typeof CIVICS_QUIZ_DATA !== "undefined" ? CIVICS_QUIZ_DATA : [],
  current: typeof CURRENT_QUIZ_DATA !== "undefined" ? CURRENT_QUIZ_DATA : [],
};

function getGenreData(genre) {
  if (genre === "mix") {
    return ["geography", "civics", "current"].flatMap((key) =>
      GENRE_DATA[key].map((item) => ({ ...item, genre: key }))
    );
  }
  return (GENRE_DATA[genre] || []).map((item) => ({ ...item, genre }));
}

function updateGenreSettings() {
  const selectedGenre = document.querySelector('input[name="genre"]:checked').value;
  const isHistory = selectedGenre === "history";
  const genreData = getGenreData(selectedGenre);
  document.querySelector("#history-settings").hidden = !isHistory;
  document.querySelector("#genre-settings").hidden = isHistory || genreData.length === 0;
  document.querySelector("#construction").hidden = isHistory || genreData.length > 0;
  if (!isHistory && genreData.length === 0) {
    document.querySelector("#construction-title").textContent =
      `${genreNames[selectedGenre]} は準備中です`;
  }
  if (!isHistory && genreData.length > 0) {
    renderCategories(genreData);
  }
}

function renderCategories(genreData) {
  const categoryList = document.querySelector("#category-list");
  categoryList.innerHTML = "";
  const categories = [...new Set(genreData.map((item) => item.era || "未分類"))];
  for (const category of categories) {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${category}" checked><span>${category}</span>`;
    categoryList.append(label);
  }
  updateGenreWrongCount();
}

document.querySelectorAll('input[name="genre"]').forEach((input) => {
  input.addEventListener("change", updateGenreSettings);
});
updateGenreSettings();

function loadWrongItems() {
  try {
    const stored = JSON.parse(localStorage.getItem(WRONG_STORAGE_KEY) || "[]");
    const normalized = stored.map((key) => {
      if (typeof key !== "string") return null;
      if (getGenreData("geography").concat(getGenreData("civics"), getGenreData("current")).some((item) =>
        itemKey(item) === key
      )) return key;
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
  updateGenreWrongCount();
}

function updateGenreWrongCount() {
  const genreCount = loadWrongItems().filter((key) => key.startsWith("genre::")).length;
  const element = document.querySelector("#genre-wrong-count");
  if (element) element.textContent = String(genreCount);
}

function itemKey(item) {
  if (item.genre) {
    return `genre::${item.genre}::${item.era || "未分類"}::${item.question}::${item.answer}`;
  }
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
  if (question.mode === "answer") {
    const pool = getGenreData(
      document.querySelector('input[name="genre"]:checked').value
    ).filter((item) =>
      (item.era || "未分類") === question.era &&
      item.answer !== question.answer
    );
    const candidates = shuffle(
      [...new Set(pool.map((item) => item.answer))]
    ).slice(0, 3);
    return shuffle([question.answer, ...candidates]);
  }
  const field = question.mode === "year" ? "year" : "event";
  const pool = QUIZ_DATA.filter((item) =>
    item.era === question.era &&
    (field !== "event" || item.year !== question.item.year)
  );
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

document.querySelector("#genre-start-button").addEventListener("click", () => {
  const selectedGenre = document.querySelector('input[name="genre"]:checked').value;
  const categoryInputs = document.querySelectorAll("#category-list input:checked");
  const selectedCategories = [...categoryInputs].map((input) => input.value);
  if (!selectedCategories.length) {
    alert("出題する分野を1つ以上選択してください。");
    return;
  }

  let pool = getGenreData(selectedGenre).filter((item) =>
    selectedCategories.includes(item.era || "未分類")
  );
  const courseMode = document.querySelector('input[name="genre-course"]:checked').value;
  if (courseMode === "review") {
    const wrongKeys = new Set(loadWrongItems());
    pool = pool.filter((item) => wrongKeys.has(itemKey(item)));
    if (!pool.length) {
      alert("選択した分野には、復習する間違えた問題がありません。");
      return;
    }
  }

  const selected = shuffle(pool).slice(0, Math.min(10, pool.length));
  questions = selected.map((item) => ({
    mode: "answer",
    era: item.era || "未分類",
    item,
    question: item.question,
    answer: item.answer,
  }));

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
  const resultText = question.mode === "answer"
    ? `${isCorrect ? "正解！" : choice === null ? "時間切れ！" : "不正解"}　正解：${question.answer}`
    : `${isCorrect ? "正解！" : choice === null ? "時間切れ！" : "不正解"}　正解：${question.answer}${question.mode === "year" ? "年" : ""}　${question.item.year}年「${question.item.event}」`;
  document.querySelector("#feedback-text").textContent = resultText;
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
  const selectedGenre = document.querySelector('input[name="genre"]:checked').value;
  if (selectedGenre === "history") {
    document.querySelector("#start-button").click();
  } else {
    document.querySelector("#genre-start-button").click();
  }
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

document.querySelector("#clear-genre-wrong-button").addEventListener("click", () => {
  const remaining = loadWrongItems().filter((key) => !key.startsWith("genre::"));
  if (!loadWrongItems().some((key) => key.startsWith("genre::"))) return;
  if (confirm("ジャンル別の間違えた問題の復習履歴をすべて削除しますか？")) {
    saveWrongItems(remaining);
  }
});

// Supabase 프로젝트 URL과 공개용 anon 키를 입력하세요.
// service_role 키는 권한이 너무 강하므로 브라우저 코드에 넣으면 안 됩니다.
const SUPABASE_URL = "https://aunrfsrxsfycixcjwmhx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bnJmc3J4c2Z5Y2l4Y2p3bWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNTAwNzQsImV4cCI6MjEwNjgyNjA3NH0.4TKAk6-gHM2ewrK3dmxgrauSbvGdvrYbU9dwWOwLWtM";

// index.html에서 불러온 supabase-js v2 라이브러리로 연결 객체를 만듭니다.
// 스크립트 로딩 순서에 영향받지 않도록 안전하게 인스턴스를 가져옵니다.
let supabaseClient = null;
function getSupabaseClient() {
  if (!supabaseClient && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabaseClient;
}

// HTML에서 필요한 요소를 찾아 변수에 저장합니다.
// 이렇게 해 두면 아래 코드에서 긴 ID 선택 문장을 반복하지 않아도 됩니다.
const orderForm = document.getElementById("order-form");
const customerNameInput = document.getElementById("customer-name");
const phoneInput = document.getElementById("phone");
const drinkSelect = document.getElementById("drink");
const quantityInput = document.getElementById("quantity");
const estimatedPrice = document.getElementById("estimated-price");
const orderConfirmation = document.getElementById("order-confirmation");
const submitButton = orderForm.querySelector('button[type="submit"]');
const orderTab = document.getElementById("order-tab");
const historyTab = document.getElementById("history-tab");
const orderPanel = document.getElementById("order-panel");
const historyPanel = document.getElementById("history-panel");
const orderCount = document.getElementById("order-count");
const ordersList = document.getElementById("orders-list");

// 주문은 접수된 순서와 정보를 배열에 보관합니다. 새 주문은 배열 맨 앞에 추가합니다.
const orders = [];
let nextOrderNumber = 1;

// 선택된 음료, 사이즈, 추가 옵션, 수량으로 최종 금액을 계산합니다.
// 음료를 고르지 않았다면 사이즈나 옵션 가격이 더해지지 않도록 바로 0을 반환합니다.
function calculateTotal() {
  if (drinkSelect.value === "") {
    return 0;
  }

  // 선택된 음료 옵션의 data-price 값을 숫자로 읽습니다.
  const drinkPrice = Number(drinkSelect.selectedOptions[0].dataset.price) || 0;

  // 선택된 사이즈 하나의 data-price 값을 읽습니다.
  const selectedSize = orderForm.querySelector('input[name="size"]:checked');
  const sizePrice = selectedSize ? Number(selectedSize.dataset.price) || 0 : 0;

  // 체크된 추가 옵션을 모두 찾아 가격을 더합니다.
  const selectedOptions = orderForm.querySelectorAll('input[name="options"]:checked');
  let optionsPrice = 0;

  selectedOptions.forEach((option) => {
    optionsPrice += Number(option.dataset.price) || 0;
  });

  // 수량 입력값을 숫자로 바꿉니다. 값이 비어 있으면 기본 수량 1로 계산합니다.
  const quantity = Number(quantityInput.value) || 1;

  // 한 잔 가격에 수량을 곱해 주문 전체 금액을 반환합니다.
  return (drinkPrice + sizePrice + optionsPrice) * quantity;
}

// calculateTotal()의 결과를 화면의 예상 금액 영역에 표시합니다.
function updateEstimatedPrice() {
  const total = calculateTotal();
  estimatedPrice.textContent = `예상 금액: ${total.toLocaleString("ko-KR")}원`;

  // 주문 내용을 수정하면 이전 주문 확인 문구는 더 이상 현재 입력과 맞지 않으므로 숨깁니다.
  orderConfirmation.hidden = true;
}

// 선택 항목이 바뀌면 새 금액을 보여주고, 수량은 타이핑하는 즉시 다시 계산합니다.
orderForm.addEventListener("change", updateEstimatedPrice);
quantityInput.addEventListener("input", updateEstimatedPrice);

// 주문하기 버튼을 눌렀을 때 Supabase에 먼저 저장한 뒤 화면에 접수 결과를 보여줍니다.
orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  // 이름 앞뒤의 공백을 제외하고 비어 있는지 확인합니다.
  const customerName = customerNameInput.value.trim();
  if (customerName === "") {
    alert("이름을 입력해주세요");
    customerNameInput.focus();
    return;
  }

  // 음료가 선택되지 않았으면 안내하고 주문 처리를 멈춥니다.
  if (drinkSelect.value === "") {
    alert("음료를 선택해주세요");
    drinkSelect.focus();
    return;
  }

  // 주문 확인 문구에 넣을 사이즈, 옵션, 수량, 전체 금액을 가져옵니다.
  const selectedSize = orderForm.querySelector('input[name="size"]:checked');
  const sizeName = selectedSize ? selectedSize.value : "M";
  const selectedOptions = Array.from(
    orderForm.querySelectorAll('input[name="options"]:checked')
  ).map((option) => option.value);
  const optionsText = selectedOptions.length > 0
    ? ` (${selectedOptions.join(", ")})`
    : "";
  const quantity = Number(quantityInput.value) || 1;
  const total = calculateTotal();
  const drinkPrice = Number(drinkSelect.selectedOptions[0].dataset.price) || 0;
  const requestText = document.getElementById("request").value.trim();

  // 카드에 표시할 주문 정보를 저장 성공 후 사용할 수 있도록 미리 준비합니다.
  const order = {
    orderNumber: nextOrderNumber,
    name: customerName,
    drink: drinkSelect.value,
    size: sizeName,
    options: selectedOptions,
    quantity,
    request: requestText,
    amount: total,
    orderedAt: new Date()
  };

  // 저장 중에는 버튼을 잠가 같은 주문이 여러 번 전송되지 않도록 합니다.
  submitButton.disabled = true;
  submitButton.textContent = "저장 중...";

  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase 라이브러리를 불러오지 못했습니다. 인터넷 연결이나 광고 차단기 설정을 확인해주세요.");
    }

    // 테이블 열 이름에 맞춰 주문 데이터를 Supabase에 추가합니다.
    const { error } = await client
      .from("cafe_menu03")
      .insert({
        customer_name: customerName,
        phone: phoneInput.value.trim(),
        drink: drinkSelect.value,
        drink_price: drinkPrice,
        size: sizeName,
        options: selectedOptions,
        quantity,
        request: requestText,
        total_price: total
      });

    // Supabase가 오류를 돌려주면 성공 화면을 보여주지 않고 실패 처리로 보냅니다.
    if (error) {
      throw error;
    }

    // 저장에 성공한 주문만 메모리 목록과 확인 화면에 추가합니다.
    nextOrderNumber += 1;
    orders.unshift(order);

    // 옵션이 있으면 괄호 안에 표시하고, 없으면 괄호까지 생략합니다.
    orderConfirmation.textContent = `${customerName}님, ${drinkSelect.value} ${sizeName}사이즈${optionsText} ${quantity}잔, 총 ${total.toLocaleString("ko-KR")}원 주문이 접수되었습니다!`;
    orderConfirmation.hidden = false;
    renderOrders();
  } catch (error) {
    // 저장에 실패한 이유는 개발자 도구에서 확인하고, 사용자에게도 원인을 안내합니다.
    console.error("Supabase 주문 저장 오류:", error);
    alert(`주문 저장에 실패했어요:\n${error.message || JSON.stringify(error)}`);
  } finally {
    // 성공하거나 실패해도 버튼을 다시 눌러 사용할 수 있게 돌려놓습니다.
    submitButton.disabled = false;
    submitButton.textContent = "주문하기";
  }
});

// 다시 작성 버튼은 HTML 기본 초기화 동작으로 M 사이즈와 수량 1로 돌아갑니다.
// reset 이벤트 직후에는 아직 이전 값일 수 있어, 초기화가 끝난 다음 금액을 다시 표시합니다.
orderForm.addEventListener("reset", () => {
  window.setTimeout(() => {
    updateEstimatedPrice();
  }, 0);
});

// 탭을 누르면 해당 화면만 보이고, 선택 상태도 함께 바꿉니다.
function showTab(showHistory) {
  orderPanel.classList.toggle("hidden", showHistory);
  historyPanel.classList.toggle("hidden", !showHistory);
  orderTab.setAttribute("aria-selected", String(!showHistory));
  historyTab.setAttribute("aria-selected", String(showHistory));
}

orderTab.addEventListener("click", () => showTab(false));
historyTab.addEventListener("click", () => showTab(true));

// 배열의 주문 내역을 화면에 그립니다. 사용자 입력은 textContent로만 넣어 HTML로 실행되지 않게 합니다.
function renderOrders() {
  ordersList.replaceChildren();
  orderCount.textContent = String(orders.length);

  if (orders.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "orders-empty";
    emptyMessage.textContent = "아직 주문 내역이 없어요 ☕";
    ordersList.append(emptyMessage);
  } else {
    const cards = document.createElement("div");
    cards.className = "orders-list";

    orders.forEach((order) => {
      const card = document.createElement("article");
      card.className = "order-card";

      const heading = document.createElement("div");
      heading.className = "order-card-heading";

      const summary = document.createElement("strong");
      summary.textContent = `#${order.orderNumber} ${order.name}님 · ${order.amount.toLocaleString("ko-KR")}원`;

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "cancel-order";
      cancelButton.dataset.orderAction = "cancel";
      cancelButton.dataset.orderNumber = String(order.orderNumber);
      cancelButton.textContent = "취소";
      heading.append(summary, cancelButton);

      const description = document.createElement("p");
      description.className = "order-card-description";
      const optionsText = order.options.length > 0
        ? ` (${order.options.join(", ")})`
        : "";
      description.textContent = `${order.drink} ${order.size}사이즈${optionsText} ${order.quantity}잔`;

      const details = document.createElement("p");
      details.className = "order-card-meta";
      const detailParts = [];
      if (order.request !== "") {
        detailParts.push(`요청사항: ${order.request}`);
      }
      detailParts.push(order.orderedAt.toLocaleString("ko-KR"));
      details.textContent = detailParts.join(" · ");

      card.append(heading, description, details);
      cards.append(card);
    });

    ordersList.append(cards);
  }

  // 취소한 주문을 제외한 현재 내역의 총액과 건수를 보여줍니다.
  const totalAmount = orders.reduce((total, order) => total + order.amount, 0);
  const footer = document.createElement("div");
  footer.className = "orders-footer";

  const total = document.createElement("p");
  total.className = "orders-total";
  total.textContent = `총 주문 금액: ${totalAmount.toLocaleString("ko-KR")}원 (${orders.length}건)`;

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "clear-orders";
  clearButton.dataset.orderAction = "clear";
  clearButton.textContent = "내역 모두 지우기";

  footer.append(total, clearButton);
  ordersList.append(footer);
}

// 목록의 취소 버튼과 전체 삭제 버튼을 한 곳에서 처리합니다.
ordersList.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const actionButton = event.target.closest("[data-order-action]");
  if (!actionButton) {
    return;
  }

  if (actionButton.dataset.orderAction === "cancel") {
    const orderNumber = Number(actionButton.dataset.orderNumber);
    const orderIndex = orders.findIndex((order) => order.orderNumber === orderNumber);

    if (orderIndex !== -1 && confirm("이 주문을 취소하시겠습니까?")) {
      orders.splice(orderIndex, 1);
      renderOrders();
    }
    return;
  }

  if (actionButton.dataset.orderAction === "clear" && confirm("주문 내역을 모두 지우시겠습니까?")) {
    orders.length = 0;
    renderOrders();
  }
});

// Supabase DB에서 기존 주문 내역을 불러와 화면에 표시합니다.
async function fetchOrdersFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data, error } = await client
      .from("cafe_menu03")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.warn("주문 내역 불러오기 안내:", error);
      return;
    }

    if (data && data.length > 0) {
      orders.length = 0;
      data.forEach((item) => {
        orders.push({
          orderNumber: item.id,
          name: item.customer_name,
          drink: item.drink,
          size: item.size,
          options: item.options || [],
          quantity: item.quantity,
          request: item.request || "",
          amount: item.total_price,
          orderedAt: new Date(item.created_at || item.ordered_at || Date.now())
        });
      });
      nextOrderNumber = Math.max(...orders.map((o) => o.orderNumber), 0) + 1;
      renderOrders();
    }
  } catch (err) {
    console.warn("주문 내역 연동 예외:", err);
  }
}

// 페이지가 처음 열렸을 때에도 기본 예상 금액을 표시하고 DB 주문 목록을 불러옵니다.
renderOrders();
updateEstimatedPrice();
fetchOrdersFromSupabase();

countIngredients()
countSteps()
addEventListeners()

function countIngredients() {
  let ingredients = document.querySelectorAll(".list-group-item")
  document.querySelector("#num-of-ingredients").innerHTML = ingredients.length
}

function countSteps() {
  let steps = document.querySelectorAll(".step")
  document.querySelector("#num-of-steps").innerHTML = steps.length
}

function addEventListeners() {
  document.querySelectorAll(".list-group-item").forEach((item) => {
    item.addEventListener("mouseenter", () => {
      item.children[1].removeAttribute("hidden")
      item.children[2].removeAttribute("hidden")
    })
    item.addEventListener("mouseleave", () => {
      item.children[1].setAttribute("hidden", "true")
      item.children[2].setAttribute("hidden", "true")
    })
  })
}

async function editRecipePOST(oldRecipeName) {
  try {
    let recipeName = document.querySelector("#recipe-name").value
    let ingredients = Array.from(document.querySelectorAll(".list-group-item")).map(item => item.children[0].value)
    let steps = Array.from(document.querySelectorAll(".step")).map(item => item.children[0].children[0].textContent)
    const request = await fetch("/edit-recipe", {
      method: "POST",
      headers: {
        "Content-Type":"application/json"
      },
      body: JSON.stringify({ recipeName, oldRecipeName, ingredients, steps })
    })
    if (request.redirected) {
      window.location.href = request.url
    }
  } catch (err) {
    window.location.href = "/error"
  }
}
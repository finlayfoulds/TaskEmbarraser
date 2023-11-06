const numOfIngredients = document.querySelector("#num-of-ingredients")
const newIngredient = document.querySelector("#new-ingredient")
const newStep = document.querySelector("#new-step")
const numOfSteps = document.querySelector("#num-of-steps")
const recipeName = document.querySelector("#recipe-name")

//save button
async function addPOST() {
  try {
    let ingredients = Array.from(document.querySelectorAll(".list-group-item")).map(item => item.children[0].value)
    let steps = Array.from(document.querySelectorAll(".step")).map(item => item.children[0].children[0].textContent)
    const request = await fetch("/add", {
      method: "POST",
      headers: {
        "Content-Type":"application/json"
      },
      body: JSON.stringify({ recipeName: recipeName.value, ingredients, steps })
    })
    if (request.redirected) {
      window.location.href = request.url
    }
  } catch (err) {
    window.location.href = "/error"
  }
}

//edit ingredient button functionality
function editIngredient(button) {
  const item = button.parentElement.children[0]
  item.removeAttribute("disabled")
  item.focus()
  document.addEventListener("click", (event) => {
    if (event.target !== item && event.target !== button) {
      item.setAttribute("disabled", "true")
      document.removeEventListener("click", event)
    }
  }, true)
  document.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      item.setAttribute("disabled", "true")
      document.removeEventListener("click", event)
    }
  }, true)
}

//delete ingredient button functionality
function deleteIngredient(button) {
  temp = parseInt(numOfIngredients.textContent)
    if (temp < 1) {
      return
    }
    temp--
    numOfIngredients.textContent = temp.toString()
  button.parentElement.remove()
}

//adds new ingredient to list
function addIngredients() {
  if (newIngredient.value.trim() !== "") {
    //increase number of ingredients count
    temp = parseInt(numOfIngredients.textContent)
    if (temp >= 20) {
      return
    }
    temp++
    numOfIngredients.textContent = temp.toString()
    //create clone of list ingredient item
    let clone = document.querySelector("#clone").cloneNode(true)
    clone.removeAttribute("hidden")
    clone.setAttribute("class", "list-group-item")
    clone.children[0].value = newIngredient.value.trim()
    //edit/delete buttons appear when hovering over item
    clone.addEventListener("mouseenter", () => {
      clone.children[1].removeAttribute("hidden")
      clone.children[2].removeAttribute("hidden")
    })
    clone.addEventListener("mouseleave", () => {
      clone.children[1].setAttribute("hidden", "true")
      clone.children[2].setAttribute("hidden", "true")
    })
    document.querySelector("#ingredients").appendChild(clone)
    //reset newingredient input field to default
    newIngredient.focus()
    newIngredient.value = ""
  }
}

//edit step button functionality
function editStep(button) {
  const item = button.parentElement.parentElement.children[0].children[0]
  item.removeAttribute("disabled")
  item.focus()
  document.addEventListener("click", (event) => {
    if (event.target !== item && event.target !== button) {
      item.setAttribute("disabled", "true")
      document.removeEventListener("click", event)
    }
  }, true)
  document.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      item.setAttribute("disabled", "true")
      document.removeEventListener("click", event)
    }
  }, true)
}

//delete steps button functionality
function deleteStep(button) {
  temp = parseInt(numOfSteps.textContent)
  if (temp < 1) {
    return
  }
  temp--
  numOfSteps.textContent = temp.toString()
  button.parentElement.parentElement.remove()
}

function addSteps() {
  if (newStep.value.trim() !== "") {
    //increase number of steps count
    temp = parseInt(numOfSteps.textContent)
    if (temp >= 10) {
      return
    }
    temp++
    numOfSteps.textContent = temp.toString()
    //create clone of list step item
    let clone = document.querySelector("#steps-clone").cloneNode(true)
    clone.removeAttribute("hidden")
    clone.setAttribute("class", "step")
    clone.children[0].children[0].textContent = newStep.value.trim().slice(0, 1).toUpperCase() + newStep.value.trim().slice(1)
    document.querySelector("#steps").appendChild(clone)
    //reset newsteps input field to default
    newStep.value = ""
    newStep.focus()
    newStep.setSelectionRange(0, 0)
  }
}

//enter key press means add ingredient or step
document.addEventListener("keypress", (event) => {
  let activeElement = document.activeElement
  if (activeElement === newIngredient && event.key === "Enter") {
    addIngredients()
  } else if (activeElement === newStep && event.key === "Enter") {
    event.preventDefault()
    addSteps()
  } else if (activeElement === newStep) {
    newStep.value = newStep.value.charAt(0).toUpperCase() + newStep.value.slice(1)
  } else if (activeElement === recipeName && event.key === "Enter") {
    newIngredient.focus()
  }
}) 
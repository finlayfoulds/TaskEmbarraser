function add() {
  window.location.href = "/add"
}

function deleteAccountGET() {
  window.location.href = "/delete-account"
}

function changePasswordGET() {
  window.location.href = "/change-password"
}

function editEmailGET() {
  window.location.href = "/edit-email"
}

function accountGET() {
  window.location.href = "/account"
}

async function viewRecipe(name) {
  try {
    let request = await fetch(`/fetch-view-recipe?recipeName=${name}`)
    if (request.redirected) {
      window.location.href = request.url
    }
  } catch (err) {
    window.location.href = "/error"
  }
}

async function deleteRecipe(name) {
  try {
    let request = await fetch(`/delete-recipe?recipeName=${name}`)
    if (request.redirected) {
      window.location.href = request.url
    }
  } catch (err) {
    window.location.href = "/error"
  }
}

async function editRecipe(name) {
  try {
    let request = await fetch(`/fetch-edit-recipe?recipeName=${name}`)
    if (request.redirected) {
      window.location.href = request.url
    }
  } catch (err) {
    window.location.href = "/error"
  }
}
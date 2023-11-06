import express from "express"
import bodyParser from "body-parser"
import bcrypt from "bcrypt"
import mysql from "mysql2"
import dotenv from "dotenv"
import session from "express-session"
import { join, dirname} from 'path'
import { fileURLToPath } from 'url'

dotenv.config()
const port = process.env.PORT || 3000
const app = express()
const __dirname = dirname(fileURLToPath(import.meta.url));

//express middleware
app.use(express.static(__dirname + "static"));
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(session({
  secret: process.env.SESSION_KEY,
  resave: false,
  saveUninitialized: false,
}))

//static files
app.get("/static/styles.css", (req, res) => {
  res.setHeader("Content-Type", "text/css")
  res.sendFile(join(__dirname, "static", "styles.css"))
})

app.get("/static/index.js", (req, res) => {
  res.setHeader("Content-Type", "text/css")
  res.sendFile(join(__dirname, "static", "index.js"))
})

app.get("/static/add.js", (req, res) => {
  res.setHeader("Content-Type", "text/css")
  res.sendFile(join(__dirname, "static", "add.js"))
})

app.get("/static/edit-recipe.js", (req, res) => {
  res.setHeader("Content-Type", "text/css")
  res.sendFile(join(__dirname, "static", "edit-recipe.js"))
})

//connect mySQL DB
var db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USERNAME,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
}).promise()

//custom loginRequired middleware
async function loginRequired(req, res, next) {
  if (req.session.userId === undefined) {
    return res.redirect("/login")
  } else {
    return next()
  }
}

//custom notLoggedIn middleware
function notLoggedIn(req, res, next) {
  if (req.session.userId === undefined) {
    return next()
  }
  return res.redirect("/")
}

let allFieldsRequired = false
let nonExistantUser = false
let passwordsDoNotMatch = false
let existingUser = false
let incorrectPassword = false
let fieldUpdatedSuccessfully = null
let currentEmail = null

app.get("/", loginRequired, async (req, res) => {
  //get users recipes
  let titles = await db.query("SELECT recipe_name FROM recipes WHERE user_id = ?", [req.session.userId])
  if (titles[0][0] !== undefined) {
    titles = titles[0].flat().map((item) => item.recipe_name)
  } else {
    //if user has no recipes
    titles = null
  }
  res.render("home.ejs", { userId: req.session.userId, titles })
})

app.get("/view-recipe", loginRequired, async (req, res) => {
  const recipeName = req.query.recipeName
  //if an error occured
  if (recipeName === undefined) {
    return res.redirect("/error")
  }
  let recipe = await db.query("SELECT id FROM recipes WHERE recipe_name = ? AND user_id = ?", [recipeName, req.session.userId])
  //get steps and ingredients of recipe based on id
  let ingredients = await db.query("SELECT ingredient FROM ingredients WHERE recipe_id = ? AND user_id = ?", [recipe[0][0].id, req.session.userId])
  ingredients = ingredients[0].flat().map((item) => item.ingredient)
  let steps = await db.query("SELECT step FROM steps WHERE recipe_id = ? AND user_id = ? ORDER BY number ASC", [recipe[0][0].id, req.session.userId])
  steps = steps[0].flat().map((item) => item.step)
  return res.render("view-recipe.ejs", { userId: req.session.userId, recipeName, ingredients, steps })
})

//render template is seperate directory as view-recipe.ejs is rendered through res.render which isnt valid fetch response
app.get("/fetch-view-recipe", loginRequired, async (req, res) => {
  //if an error occured
  if (req.query.recipeName === undefined) {
    return res.redirect("/error")
  }
  //redirect for template to get rendered
  return res.redirect(`/view-recipe?recipeName=${req.query.recipeName}`)
})

app.get("/delete-recipe", loginRequired, async (req, res) => {
  const recipeName = req.query.recipeName
  //if no recipe chosen
  if (recipeName === undefined) {
    return res.redirect("/error")
  }
  //delete all recipe data
  let recipeId = await db.query("SELECT id FROM recipes WHERE recipe_name = ? AND user_id = ?", [recipeName, req.session.userId])
  recipeId = recipeId[0][0].id
  await db.query("DELETE FROM recipes WHERE id = ? AND user_id = ?", [recipeId, req.session.userId])
  await db.query("DELETE FROM steps WHERE recipe_id = ? AND user_id = ?", [recipeId, req.session.userId])
  await db.query("DELETE FROM ingredients WHERE recipe_id = ? AND user_id = ?", [recipeId, req.session.userId])
  return res.redirect("/")
})

app.route("/edit-recipe")

//render template is seperate directory as edit-recipe.ejs is rendered through res.render which isnt valid fetch response
.get(loginRequired, async (req, res) => {
  const recipeName = req.query.recipeName
  //get recipes id
  let recipeId = await db.query("SELECT id FROM recipes WHERE recipe_name = ? AND user_id = ?", [recipeName, req.session.userId])
  //if an error occured
  if (recipeId[0][0] === undefined) {
    return res.redirect("/logout")
  }
  //get data for rendering template
  recipeId = recipeId[0][0].id
  let ingredients = await db.query("SELECT ingredient FROM ingredients WHERE user_id = ? AND recipe_id = ?", [req.session.userId, recipeId])
  ingredients = ingredients[0].flat().map((item) => item.ingredient)
  let steps = await db.query("SELECT step FROM steps WHERE recipe_id = ? AND user_id = ? ORDER BY number ASC", [recipeId, req.session.userId])
  steps = steps[0].flat().map((item) => item.step)
  return res.render("edit-recipe.ejs", { userId: req.session.userId, recipeName, ingredients, steps, allFieldsRequired, existingUser })
})

//post request to get recipe data to then render 
.post(loginRequired, async (req, res) => {
  allFieldsRequired = false
  existingUser = false
  const { oldRecipeName, recipeName, ingredients, steps } = req.body
  //if not all fields filled in
  if (recipeName === "" || ingredients === "" || steps === "") {
    allFieldsRequired = true
    res.redirect(`/edit-recipe?recipeName=${oldRecipeName}`)
  }
  //get recipes id
  let recipeId = await db.query("SELECT id FROM recipes WHERE recipe_name = ? AND user_id = ?", [oldRecipeName, req.session.userId])
  //if an error occured
  if (recipeId[0][0] === undefined) {
    return res.redirect("/logout")
  }
  recipeId = recipeId[0][0].id
  //update recipe_name if it was changed
  if (recipeName !== oldRecipeName) {
    //check for recipe with that name
    const existing = await db.query("SELECT * FROM recipes WHERE recipe_name = ? AND user_id = ?", [recipeName, req.session.userId])
    if (existing[0][0] !== undefined) {
      existingUser = true
      return res.redirect(`/edit-recipe?recipeName=${oldRecipeName}`)
    }
    await db.execute("UPDATE recipes SET recipe_name = ? WHERE id = ? AND user_id = ?", [recipeName, recipeId, req.session.userId])
  }
  //get old ingredients and steps data to verify if it was changed
  let oldIngredients = await db.query("SELECT ingredient FROM ingredients WHERE user_id = ? AND recipe_id = ?", [req.session.userId, recipeId])
  ///////////fix
  oldIngredients = oldIngredients[0].flat().map((item) => item.ingredient)
  let oldSteps = await db.query("SELECT step FROM steps WHERE recipe_id = ? AND user_id = ? ORDER BY number ASC", [recipeId, req.session.userId])
  oldSteps = oldSteps[0].flat().map((item) => item.step)
  //update ingredients if it was changed
  const ingredientsEqual = JSON.stringify(ingredients) === JSON.stringify(oldIngredients)
  if (!ingredientsEqual) {
    await db.query("DELETE FROM ingredients WHERE recipe_id = ? AND user_id = ?", [recipeId, req.session.userId])
    for (const ingredient of ingredients) {
      await db.query("INSERT INTO ingredients (user_id, recipe_id, ingredient) VALUES (?, ?, ?)", [req.session.userId, recipeId, ingredient])
    }
  }
  //update steps if it was changed
  const stepsEqual = JSON.stringify(steps) === JSON.stringify(oldSteps)
  if (!stepsEqual) {
    await db.query("DELETE FROM steps WHERE recipe_id = ? AND user_id = ?", [recipeId, req.session.userId])
    for (const [index, step] of steps.entries()) {
      await db.query("INSERT INTO steps (user_id, recipe_id, number, step) VALUES (?, ?, ?, ?)", [req.session.userId, recipeId, index, step])
    }
  }
  res.redirect(`/view-recipe?recipeName=${recipeName}`)
})

app.get("/fetch-edit-recipe", loginRequired, async (req, res) => {
  //if an error occured
  if (req.query.recipeName === undefined) {
    return res.redirect("/error")
  }
  //redirect for template to get rendered
  return res.redirect(`/edit-recipe?recipeName=${req.query.recipeName}`)
})

app.route("/register")

.get(notLoggedIn, (req, res) => {
  res.render("register.ejs", { allFieldsRequired, passwordsDoNotMatch, existingUser, userId: req.session.userId })
})

.post(notLoggedIn, async (req, res) => {
  allFieldsRequired = false
  passwordsDoNotMatch = false
  existingUser = false
  const { email, password, verify, recieveEmails } = req.body
  //if all fields not filled out
  if (email === "" || password === "" || verify === "") {
    allFieldsRequired = true
    return res.redirect("/register")
    //if passwords are not the same
  } else if (password != verify) {
    passwordsDoNotMatch = true
    return res.redirect("/register")
  }
  //if existing user
  const existing = await db.query("SELECT * FROM users WHERE email = ?", [email])
  if (existing[0][0] !== undefined) {
    existingUser = true
    return res.redirect("/register")
  }
  //if email and password valid
  let hash = await bcrypt.hash(password, 12)
  await db.query("INSERT INTO users (email, hash, recieveEmails) VALUES (?, ?, ?)", [email, hash, recieveEmails])
  let id = await db.query("SELECT id FROM users WHERE email = ? AND hash = ?", [email, hash])
  id = id[0][0].id
  req.session.userId = id
  return res.redirect("/")
})

app.route("/login")

.get(notLoggedIn, (req, res) => {
  res.render("login.ejs", { allFieldsRequired, nonExistantUser, incorrectPassword, userId: req.session.userId, login: true })
})

.post(notLoggedIn, async (req, res) => {
  allFieldsRequired = false
  nonExistantUser = false
  incorrectPassword = false
  //if all fields not filled out
  const { email, password } = req.body
  if (email === "" || password === "") {
    allFieldsRequired = true
    return res.redirect("/login")
  }
  let user = await db.query("SELECT id, hash FROM users WHERE email = ?", [email])
  //if user doesnt exist
  if (user[0][0] === undefined) {
    nonExistantUser = true
    return res.redirect("/login")
  } 
  //if email and password are correct
  if (!(await bcrypt.compare(password, user[0][0].hash))) {
    incorrectPassword = true
    return res.redirect("/login")
  }
  //if password incorrect
  req.session.userId = user[0][0].id
  return res.redirect("/")
})

app.get("/logout", loginRequired, (req, res) => {
  req.session.destroy()
  res.redirect("/login")
})

app.get("/account", loginRequired, async (req, res) => {
  let check;
  //check if recieveEmails was previously checked and get the old email
  let info = await db.query("SELECT email, recieveEmails FROM users WHERE id = ?", [req.session.userId])
  currentEmail = info[0][0].email
  if (info[0][0].recieveEmails === 1) {
    check = true
  } else {
    check = false
  }
  res.render("account.ejs", { fieldUpdatedSuccessfully, currentEmail, check, userId: req.session.userId })
})

app.route("/edit-email")

.get(loginRequired, async (req, res) => {
  res.render("edit-email.ejs", { currentEmail, existingUser, incorrectPassword, allFieldsRequired, userId: req.session.userId })
})

.post(loginRequired, async (req, res) => {
  allFieldsRequired = false
  incorrectPassword = false
  existingUser = false
  fieldUpdatedSuccessfully = null
  const { email, password } = req.body
  //check all fields filled in
  if (email === "" || password === "") {
    allFieldsRequired = true
    return res.redirect("/edit-email")
  }
  //check passwords correct
  incorrectPassword = await db.query("SELECT hash FROM users WHERE id = ?", [req.session.userId])
  if (!(await bcrypt.compare(password, incorrectPassword[0][0].hash))) {
    incorrectPassword = true
    return res.redirect("/edit-email")
  } 
  //check for an existing user with that email
  const existing = await db.query("SELECT * FROM users WHERE email = ?", [email])
  if (existing[0][0] !== undefined) {
    existingUser = true
    return res.redirect("/edit-email")
  }
  await db.query("UPDATE users SET email = ? WHERE id = ?", [email, req.session.userId])
  fieldUpdatedSuccessfully = "email"
  return res.redirect("/account")
})

app.route("/change-password")

.get(loginRequired, async (req, res) => {
  res.render("change-password.ejs", { userId: req.session.userId, passwordsDoNotMatch, allFieldsRequired, incorrectPassword, fieldUpdatedSuccessfully })
})

.post(loginRequired, async (req, res) => {
  passwordsDoNotMatch = false
  allFieldsRequired = false
  incorrectPassword = false
  fieldUpdatedSuccessfully = null
  let oldPassword = await db.query("SELECT hash FROM users WHERE id = ?", req.session.userId)
  const { currentPassword, newPassword, verify } = req.body
  //if all field not filled in
  if (currentPassword === "" || newPassword === "" || verify === "") {
    allFieldsRequired = true
    return res.redirect("/change-password")
  }
  //if oldPassword incorrect
  if (!(await bcrypt.compare(currentPassword, oldPassword[0][0].hash))) {
    incorrectPassword = true
    return res.redirect("/change-password")
  }
  //if password fields do not match
  if (newPassword !== verify) {
    passwordsDoNotMatch = true
    return res.redirect("/change-password")
  }
  await db.query("UPDATE users SET hash = ? WHERE id = ?", [await bcrypt.hash(newPassword, 12), req.session.userId])
  fieldUpdatedSuccessfully = "password"
  return res.redirect("/account")
})

app.post("/edit-recieveEmails", loginRequired, async (req, res) => {
  //update recieveEmails if changed
  await db.query("UPDATE users SET recieveEmails = ? WHERE id = ?", [req.body.recieveEmails, req.session.userId])
  fieldUpdatedSuccessfully = "recieveEmails"
  return res.redirect("/account")
})

app.route("/delete-account")

.get(loginRequired, (req, res) => {
  res.render("delete-account.ejs", { incorrectPassword, userId: req.session.userId })
})

.post(loginRequired, async (req, res) => {
  incorrectPassword = false
  let hash = await db.query("SELECT hash FROM users WHERE id = ?", req.session.userId)
  // if password incorrect
  if (!(await bcrypt.compare(req.body.password, hash[0][0].hash))) {
    incorrectPassword = true
    return res.redirect("/delete-account")
  }
  //destroy user session and delete account
  await db.query("DELETE FROM users WHERE id = ?", [req.session.userId])
  await db.query("DELETE FROM recipes WHERE user_id = ?", [req.session.userId])
  await db.query("DELETE FROM ingredients WHERE user_id = ?", [req.session.userId])
  await db.query("DELETE FROM steps WHERE user_id = ?", [req.session.userId])
  req.session.destroy()
  return res.redirect("/register")
})

app.route("/add")

.get(loginRequired, (req, res) => {
  res.render("add.ejs", { userId: req.session.userId, allFieldsRequired, existingUser })
})

.post(loginRequired, async (req, res) => {
  allFieldsRequired = false
  existingUser = false
  const { recipeName, ingredients, steps } = req.body
  //check all fields filled in
  if (recipeName === "" || ingredients === "" || steps === "") {
    allFieldsRequired = true
    return res.redirect("/add")
  }
  //check for recipe with that name
  const existing = await db.query("SELECT * FROM recipes WHERE recipe_name = ? AND user_id = ?", [recipeName, req.session.userId])
  if (existing[0][0] !== undefined) {
    existingUser = true;
    return res.redirect("/add")
  }
  //insert all data to db
  await db.query("INSERT INTO recipes (user_id, recipe_name) VALUES (?, ?)", [req.session.userId, recipeName])
  const recipe_id = await db.query("SELECT LAST_INSERT_ID() as id")
  for (const ingredient of ingredients) {
    await db.query("INSERT INTO ingredients (user_id, recipe_id, ingredient) VALUES (?, ?, ?)", [req.session.userId, recipe_id[0][0].id, ingredient])
  }
  for (const [index, step] of steps.entries()) {
    await db.query("INSERT INTO steps (user_id, recipe_id, number, step) VALUES (?, ?, ?, ?)", [req.session.userId, recipe_id[0][0].id, index, step])
  }
  return res.redirect("/")
})

app.get("/error", (req, res) => {
  res.sendFile(join(__dirname, "views", "error.html"))
})

app.use((req, res, next) => {
  res.status(404).sendFile(join(__dirname, "views", "unfound-page.html"))
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
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
  //if no user session
  if (req.session.userId === undefined) {
    //redirect to login
    return res.redirect("/login")
  } 
  //else continue
  return next()
}

//custom notLoggedIn middleware
function notLoggedIn(req, res, next) {
  //if no user session
  if (req.session.userId === undefined) {
    //continue
    return next()
  }
  //else redirect to home
  return res.redirect("/")
}

//declaring global variables
let allFieldsRequired
let nonExistantUser
let passwordsDoNotMatch
let existingUser
let incorrectPassword
let fieldUpdatedSuccessfully
let currentEmail

app.get("/", loginRequired, async (req, res) => {

  //get users recipes
  let titles = await db.query("SELECT recipe_name FROM recipes WHERE user_id = ?", [req.session.userId])
  if (titles[0][0] !== undefined) {
    titles = titles[0].flat().map((item) => item.recipe_name)
  } else {

    //if user has no recipes
    titles = null
  }
  //render template
  res.render("home.ejs", { userId: req.session.userId, titles })
})

app.get("/view-recipe", loginRequired, async (req, res) => {

  //declaring and initializing recipeName
  const recipeName = req.query.recipeName

  //get recipe id
  let recipeId = await db.query("SELECT id FROM recipes WHERE recipe_name = ? AND user_id = ?", [recipeName, req.session.userId])

  //if an error occured
  if (recipeId[0][0] === undefined) {
    return res.redirect("/error")
  }
  //else:
  recipeId = recipeId[0][0].id

  //get ingredients with that id
  let ingredients = await db.query("SELECT ingredient FROM ingredients WHERE recipe_id = ? AND user_id = ?", [recipeId, req.session.userId])
  //convert to array of just ingredients
  ingredients = ingredients[0].flat().map((item) => item.ingredient)

  //get steps with that id
  let steps = await db.query("SELECT step FROM steps WHERE recipe_id = ? AND user_id = ? ORDER BY number ASC", [recipeId, req.session.userId])
  //convert to array of just steps
  steps = steps[0].flat().map((item) => item.step)

  //render template
  return res.render("view-recipe.ejs", { userId: req.session.userId, recipeName, ingredients, steps })
})

//Note: render template is seperate directory as view-recipe.ejs is rendered through res.render which isnt valid fetch response
app.get("/fetch-view-recipe", loginRequired, async (req, res) => {

  //if no recipe chosen
  if (req.query.recipeName === undefined) {
    return res.redirect("/error")
  }

  //redirect for template to get rendered
  return res.redirect(`/view-recipe?recipeName=${req.query.recipeName}`)
})

app.get("/delete-recipe", loginRequired, async (req, res) => {

  //declaring and initializing recipeName
  const recipeName = req.query.recipeName

  //get recipe id
  let recipeId = await db.query("SELECT id FROM recipes WHERE recipe_name = ? AND user_id = ?", [recipeName, req.session.userId])

  //if no recipe chosen
  if (recipeId[0][0] === undefined) {
    return res.redirect("/error")
  }
  //else:
  recipeId = recipeId[0][0].id

   //delete all recipe data
  await db.query("DELETE FROM recipes WHERE id = ? AND user_id = ?", [recipeId, req.session.userId])
  await db.query("DELETE FROM steps WHERE recipe_id = ? AND user_id = ?", [recipeId, req.session.userId])
  await db.query("DELETE FROM ingredients WHERE recipe_id = ? AND user_id = ?", [recipeId, req.session.userId])

  //redirect user to home
  return res.redirect("/")
})

app.route("/edit-recipe")

//Note: render template is seperate directory as edit-recipe.ejs is rendered through res.render which isnt valid fetch response
.get(loginRequired, async (req, res) => {

  //declaring and initializing recipeName
  const recipeName = req.query.recipeName

  //get recipes id
  let recipeId = await db.query("SELECT id FROM recipes WHERE recipe_name = ? AND user_id = ?", [recipeName, req.session.userId])
  
  //if no recipe chosen
  if (recipeId[0][0] === undefined) {
    return res.redirect("/logout")
  }
  //else:
  recipeId = recipeId[0][0].id

  //get current ingredients
  let ingredients = await db.query("SELECT ingredient FROM ingredients WHERE user_id = ? AND recipe_id = ?", [req.session.userId, recipeId])
  //convert to array of just ingredients
  ingredients = ingredients[0].flat().map((item) => item.ingredient)

  //get current steps
  let steps = await db.query("SELECT step FROM steps WHERE recipe_id = ? AND user_id = ? ORDER BY number ASC", [recipeId, req.session.userId])
  //convert to array of just steps
  steps = steps[0].flat().map((item) => item.step)

  //render template with all ingredients, steps and recipeName etc
  return res.render("edit-recipe.ejs", { userId: req.session.userId, recipeName, ingredients, steps, allFieldsRequired, existingUser })
})

//edited recipe
.post(loginRequired, async (req, res) => {
  //initialize global variables specific for this route
  allFieldsRequired = false
  existingUser = false

  //get post data
  const { oldRecipeName, recipeName, ingredients, steps } = req.body

  //if not all fields filled in
  if (recipeName === "" || ingredients === "" || steps === "") {
    allFieldsRequired = true

    //redirect with all field required error message
    res.redirect(`/edit-recipe?recipeName=${oldRecipeName}`)
  }

  //get recipes id
  let recipeId = await db.query("SELECT id FROM recipes WHERE recipe_name = ? AND user_id = ?", [oldRecipeName, req.session.userId])
  //if an error occured
  if (recipeId[0][0] === undefined) {
    return res.redirect("/logout")
  }
  //else:
  recipeId = recipeId[0][0].id

  //update recipe name if it was changed
  if (recipeName !== oldRecipeName) {

    //check for existing recipe with new recipe name
    const existing = await db.query("SELECT * FROM recipes WHERE recipe_name = ? AND user_id = ?", [recipeName, req.session.userId])
    if (existing[0][0] !== undefined) {
      existingUser = true

      //if existing recipe redirect with existing recipe error message
      return res.redirect(`/edit-recipe?recipeName=${oldRecipeName}`)
    }
    //else update recipe name
    await db.execute("UPDATE recipes SET recipe_name = ? WHERE id = ? AND user_id = ?", [recipeName, recipeId, req.session.userId])
  }

  //get existing ingredients
  let oldIngredients = await db.query("SELECT ingredient FROM ingredients WHERE user_id = ? AND recipe_id = ?", [req.session.userId, recipeId])
  //convert to array of just ingredients
  oldIngredients = oldIngredients[0].flat().map((item) => item.ingredient)

  //get existing steps
  let oldSteps = await db.query("SELECT step FROM steps WHERE recipe_id = ? AND user_id = ? ORDER BY number ASC", [recipeId, req.session.userId])
  //convert to array of just steps
  oldSteps = oldSteps[0].flat().map((item) => item.step)

  //check posted ingredients with existing ingredients
  if (!JSON.stringify(ingredients) === JSON.stringify(oldIngredients)) {
    //if ingredients do not equal:
    //delete existing ingredients
    await db.query("DELETE FROM ingredients WHERE recipe_id = ? AND user_id = ?", [recipeId, req.session.userId])
    //add posted ingredients
    for (const ingredient of ingredients) {
      await db.query("INSERT INTO ingredients (user_id, recipe_id, ingredient) VALUES (?, ?, ?)", [req.session.userId, recipeId, ingredient])
    }
  }

  //check posted steps with existing steps
  if (!JSON.stringify(steps) === JSON.stringify(oldSteps)) {
    //if steps do not equal:
    //delete existing steps
    await db.query("DELETE FROM steps WHERE recipe_id = ? AND user_id = ?", [recipeId, req.session.userId])
    //add posted steps
    for (const [index, step] of steps.entries()) {
      await db.query("INSERT INTO steps (user_id, recipe_id, number, step) VALUES (?, ?, ?, ?)", [req.session.userId, recipeId, index, step])
    }
  }

  //redirect to view updated recipe
  res.redirect(`/view-recipe?recipeName=${recipeName}`)
})

//Note: render template is seperate directory as edit-recipe.ejs is rendered through res.render which isnt valid fetch response
app.get("/fetch-edit-recipe", loginRequired, async (req, res) => {
  //if no recipe selected
  if (req.query.recipeName === undefined) {
    return res.redirect("/error")
  }

  //redirect for template to get rendered
  return res.redirect(`/edit-recipe?recipeName=${req.query.recipeName}`)
})

app.route("/register")

.get(notLoggedIn, (req, res) => {

  //render template
  res.render("register.ejs", { allFieldsRequired, passwordsDoNotMatch, existingUser, userId: req.session.userId })
})

.post(notLoggedIn, async (req, res) => {
  //initialize global variables specific for this route
  allFieldsRequired = false
  passwordsDoNotMatch = false
  existingUser = false

  //get posted new user data
  const { email, password, verify, recieveEmails } = req.body

  //if all fields not filled out
  if (email === "" || password === "" || verify === "") {
    allFieldsRequired = true

    //redirect with all field required error message
    return res.redirect("/register")

    //else if passwords are not the same
  } else if (password != verify) {
    passwordsDoNotMatch = true

    //redirect with passwords do not match error message
    return res.redirect("/register")
  }

  //else if check for existing user with that email
  const existing = await db.query("SELECT * FROM users WHERE email = ?", [email])
  if (existing[0][0] !== undefined) {
    existingUser = true

    //redirect with existing user error message
    return res.redirect("/register")
  }

  //hash and salt passwoed
  let hash = await bcrypt.hash(password, 12)

  //insert email, hash and recieve emails or not into db
  await db.query("INSERT INTO users (email, hash, recieveEmails) VALUES (?, ?, ?)", [email, hash, recieveEmails])

  //log user in and create user session with users id
  let id = await db.query("SELECT id FROM users WHERE email = ? AND hash = ?", [email, hash])
  id = id[0][0].id
  req.session.userId = id

  //redirect to home
  return res.redirect("/")
})

app.route("/login")

.get(notLoggedIn, (req, res) => {

  //render template
  res.render("login.ejs", { allFieldsRequired, nonExistantUser, incorrectPassword, userId: req.session.userId, login: true })
})

.post(notLoggedIn, async (req, res) => {
  //initialize global variables specific for this route
  allFieldsRequired = false
  nonExistantUser = false
  incorrectPassword = false

  //get posted data
  const { email, password } = req.body

  //if all fields not filled out
  if (email === "" || password === "") {
    allFieldsRequired = true

    //redirect to login with all fields required error message
    return res.redirect("/login")
  }
  //else get user id and hash
  let user = await db.query("SELECT id, hash FROM users WHERE email = ?", [email])

  //if user with user[0][0].id doesnt exisst
  if (user[0][0] === undefined) {
    nonExistantUser = true

    //redirect to login with non existing user error message
    return res.redirect("/login")
  } 

  //else if password not correct
  if (!(await bcrypt.compare(password, user[0][0].hash))) {
    incorrectPassword = true

    //redirect to login with incorrect password error message
    return res.redirect("/login")
  }
  
  //else create user session
  req.session.userId = user[0][0].id
  //redirect to home
  return res.redirect("/")
})

app.get("/logout", loginRequired, (req, res) => {
  //destroy user session
  req.session.destroy()
  //redirect user to login
  res.redirect("/login")
})

app.get("/account", loginRequired, async (req, res) => {
  //define check within scope
  let check

  //get user info (email and recieveEmails)
  let info = await db.query("SELECT email, recieveEmails FROM users WHERE id = ?", [req.session.userId])
  currentEmail = info[0][0].email

  //check if recieveEmails was set to 1 or NULL (yes or no)
  if (info[0][0].recieveEmails === 1) {
    check = true
  } else {
    check = false
  }
  res.render("account.ejs", { fieldUpdatedSuccessfully, currentEmail, check, userId: req.session.userId })
})

app.route("/edit-email")

.get(loginRequired, async (req, res) => {
  //render template
  res.render("edit-email.ejs", { currentEmail, existingUser, incorrectPassword, allFieldsRequired, userId: req.session.userId })
})

.post(loginRequired, async (req, res) => {
  //initialize global variables specific for this route
  allFieldsRequired = false
  incorrectPassword = false
  existingUser = false
  fieldUpdatedSuccessfully = null

  //get posted data
  const { email, password } = req.body

  //if all fields not filled out
  if (email === "" || password === "") {
    allFieldsRequired = true
    
    //redirect to edit email with all fields required error message
    return res.redirect("/edit-email")
  }

  //else if check passwords correct
  incorrectPassword = await db.query("SELECT hash FROM users WHERE id = ?", [req.session.userId])
  if (!(await bcrypt.compare(password, incorrectPassword[0][0].hash))) {
    incorrectPassword = true

    //redirect to edit email with incorrect password error message
    return res.redirect("/edit-email")
  } 

  //else if existing user with that email
  const existing = await db.query("SELECT * FROM users WHERE email = ?", [email])
  if (existing[0][0] !== undefined) {
    existingUser = true

    //redirect to edit email with existing user error message
    return res.redirect("/edit-email")
  }

  //else update users email
  await db.query("UPDATE users SET email = ? WHERE id = ?", [email, req.session.userId])
  fieldUpdatedSuccessfully = "email"

  //redirect to account with email updated succesfully success message
  return res.redirect("/account")
})

app.route("/change-password")

.get(loginRequired, async (req, res) => {
  //render template
  res.render("change-password.ejs", { userId: req.session.userId, passwordsDoNotMatch, allFieldsRequired, incorrectPassword, fieldUpdatedSuccessfully })
})

.post(loginRequired, async (req, res) => {
  //initialize global variables specific for this route
  passwordsDoNotMatch = false
  allFieldsRequired = false
  incorrectPassword = false
  fieldUpdatedSuccessfully = null

  //get posted data
  const { currentPassword, newPassword, verify } = req.body

  //if all field not filled in
  if (currentPassword === "" || newPassword === "" || verify === "") {
    allFieldsRequired = true

    //redirect to change password with all fields required error message
    return res.redirect("/change-password")
  }

  //get users current hash
  let currentHash = await db.query("SELECT hash FROM users WHERE id = ?", [req.session.userId])

  //else if current password incorrect
  if (!(await bcrypt.compare(currentPassword, currentHash[0][0].hash))) {
    incorrectPassword = true

    //redirect to change password with with incorrect password error message
    return res.redirect("/change-password")
  }

  //else if new password fields do not match
  if (newPassword !== verify) {
    passwordsDoNotMatch = true

    //redirect to change password with passwords don't match error message
    return res.redirect("/change-password")
  }

  //else update users password
  await db.query("UPDATE users SET hash = ? WHERE id = ?", [await bcrypt.hash(newPassword, 12), req.session.userId])
  fieldUpdatedSuccessfully = "password"

  //redirect to account with password changed succesfully success message
  return res.redirect("/account")
})

app.post("/edit-recieveEmails", loginRequired, async (req, res) => {
  //update recieveEmails
  await db.query("UPDATE users SET recieveEmails = ? WHERE id = ?", [req.body.recieveEmails, req.session.userId])
  fieldUpdatedSuccessfully = "recieveEmails"

  //redirect to account with recieve emails updated succesfully success message
  return res.redirect("/account")
})

app.route("/delete-account")

.get(loginRequired, (req, res) => {
  //render template
  res.render("delete-account.ejs", { incorrectPassword, userId: req.session.userId })
})

.post(loginRequired, async (req, res) => {
  //initialize global variables specific for this route
  incorrectPassword = false

  //get users hash
  let hash = await db.query("SELECT hash FROM users WHERE id = ?", req.session.userId)

  // if posted password is incorrect
  if (!(await bcrypt.compare(req.body.password, hash[0][0].hash))) {
    incorrectPassword = true

    //redirect to delete account with incorrect password error message
    return res.redirect("/delete-account")
  }

  //destroy user session and delete account and account data
  await db.query("DELETE FROM users WHERE id = ?", [req.session.userId])
  await db.query("DELETE FROM recipes WHERE user_id = ?", [req.session.userId])
  await db.query("DELETE FROM ingredients WHERE user_id = ?", [req.session.userId])
  await db.query("DELETE FROM steps WHERE user_id = ?", [req.session.userId])
  req.session.destroy()

  //redirect to register
  return res.redirect("/register")
})

//add recipe route
app.route("/add")

.get(loginRequired, (req, res) => {
  //render template
  res.render("add.ejs", { userId: req.session.userId, allFieldsRequired, existingUser })
})

.post(loginRequired, async (req, res) => {
  //initialize global variables specific for this route
  allFieldsRequired = false
  existingUser = false

  //get posted data
  const { recipeName, ingredients, steps } = req.body

  //if check all fields not filled in
  if (recipeName === "" || ingredients === "" || steps === "") {
    allFieldsRequired = true

    //redirect to add with all fields required error message
    return res.redirect("/add")
  }

  //else if existing recipe with that name
  const existing = await db.query("SELECT * FROM recipes WHERE recipe_name = ? AND user_id = ?", [recipeName, req.session.userId])
  if (existing[0][0] !== undefined) {
    existingUser = true

    //redirect to add with existing recipe name error message
    return res.redirect("/add")
  }

  //else insert recipe name into db
  await db.query("INSERT INTO recipes (user_id, recipe_name) VALUES (?, ?)", [req.session.userId, recipeName])

  //get recipes id
  const recipe_id = await db.query("SELECT LAST_INSERT_ID() as id")

  //insert ingredients to db
  for (const ingredient of ingredients) {
    await db.query("INSERT INTO ingredients (user_id, recipe_id, ingredient) VALUES (?, ?, ?)", [req.session.userId, recipe_id[0][0].id, ingredient])
  }

  //insert steps to db
  for (const [index, step] of steps.entries()) {
    await db.query("INSERT INTO steps (user_id, recipe_id, number, step) VALUES (?, ?, ?, ?)", [req.session.userId, recipe_id[0][0].id, index, step])
  }

  //redirect to home
  return res.redirect("/")
})

app.get("/error", (req, res) => {
  //render template
  res.sendFile(join(__dirname, "views", "error.html"))
})

//catch unfound pages
app.use((req, res, next) => {
  //render unfound pages template
  res.status(404).sendFile(join(__dirname, "views", "unfound-page.html"))
})

//server listen
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
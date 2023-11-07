# TaskEmbarraser

### Description:
My website TaskEmbarraser is designed for storing your favourite recipes with ease and
simplicity. I made this website for my granny who has so many wonderful recipes she’s
perfected over the years and has cooked for me countless times, for years and now she
can store them online so to never forget them.

Now when you first go to the website you will be prompted to login. If you do not have
an account you can click register in the top right. Using custom middleware you will
not be able to go to certain routes if you are not logged in using user sessions.
Alternatively you will not be able to go to certain routes if you are logged in, such as
“/register”. When you create your account we verify your email is not already in use
using mysql database queries and that your passwords match.

Once you have logged in and the server has verified that you have an account and your
password is correct using hashing and salting you will be redirected to the home page
Once you create recipes they will appear here and you can add recipes using the blue
add button in the nav bar. When you create a recipe you can enter a recipe name, a max
of 20 ingredients and a max of 10 steps to make the dish. Once you create the recipe it
will appear on your home page where you can click on it to view it, and there you will
find edit and delete buttons. When you click edit you will be taken to a page with your
recipe info where you can edit, add and delete from it as you, the user, pleases. You
can also simply delete the recipe using the delete button.

In the nav bar you will notice there are a few other buttons. The logo when clicked on
takes you back to home, the logout button allows the user to log out, and finally the
account option will take you to a page with your user info and allow you to change
things like email, password etc. The user can store as many recipes as they want and
change and read them accordingly.

On a side note I know the name of my website, TaskEmbarraser, makes no sense for the website and is actually the name I
choose for my original CS50x final project idea. However I decided to keep it as I
think it provides a little questionable touch to the website.

My name is Finlay Foulds and

### This was TaskEmbarraser

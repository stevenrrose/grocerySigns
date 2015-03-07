# grocerySigns
Grocery Store Signs

Describe the layout mechanisms using samples -or- provide to fixed examples. 

Stage 1 of project:
Word content and insertion into one of three provided grid formats.

Stage 2 of the project:
Add functionality to design of grid formats. Possible random.

PROPOSAL:
What we want to create is a series of web applications that will aggregate existing information (whether it be image, text, or other content to-be-determined) into a constrained form that is lightly-controlled by the user. The purpose is to demonstrate how a creative visual experience can be successfully conducted through random selection and fixed editorial constraints. 

There are two essential components to this series: content generation from found and existing sources and a responsive layout generated using conditional formatting and user input. 

The first application in this series will be the Grocery Sign application. The grocery sign template is one we see used over and over again throughout New York and most metropolitan locations in the U. S. We like it because it is such an efficient purveyor of information while remaining quite coded and vernacular. Upon close inspection, the lettering themselves become abstracted into some sort of concrete poetic imagery.

This program’s purpose is to generate random word configurations in the form and style of a grocery store price sign. The program will randomly select words from an existing set of content. This existing set will be accessed via a third party (Amazon, EBay Craigslist). The program should be able to copy content from real-life listing fields and match these fields to certain areas of the layout.

FIELD CONTENT GENERATION:
The program should be able to aggregate data from the existing fields on a third-party website. The program should begin by presenting a default assignment, matching the content of the existing page with the components of the grocery store sign, allowing for random and absurd connections. The program will also have the option of allowing the user assignment control.

We’ve identified the essential components of a sign as the following:
Title
Subtitle (Brand or Descriptor)
Quantity
Price + ‘$’ or other symbol
Unit of Measure
Prepositions & Conjunctions or Additional Descriptor

Here’s a few examples of taking Amazon listings and breaking them into fields for signs manually. Since these are not automated, they are considerably more edited than the program’s default will be, but they give an idea.

For example 1, we examine a scrunch butt bikini bottom: http://www.amazon.com/Modern-Scrunch-Canne-Bikini-Bottom/dp/B0081L8QGK/ref=sr_1_15?ie=UTF8&qid=1413127476&sr=8-15&keywords=scrunch+butt:

The fields would align as follows (with user edits):
Sexy Modern Scrunch Butt Canne Bikini Bottom
Body Zone Apparel
16.99
n/a
ONE SIZE
n/a

Here’s another for beef jerky:
http://www.amazon.com/Aufschnitt-Beef-Jerky-Certification-Variety/dp/B00CEZEIAC/ref=sr_1_11?s=grocery&ie=UTF8&qid=1413130210&sr=1-11&keywords=meat

Aufschnitt Beef Jerky
Kosher, Glatt, Star-K Certification (Case of 24) (Variety)
24 packets
109.99
Case
per

And another more random:
http://www.amazon.com/Artificial-Green-Purple-Cluster-Pieces/dp/B005HWUD26/ref=sr_1_1?ie=UTF8&qid=1414715804&sr=8-1&keywords=grapes

Artificial Green & Purple Grape Cluster, Set of 2 Pieces
By Spring Time
8.96
Flying Coffe Birds
SIZE: 11” LONG
Very Lifelike

LAYOUT:
The program will provide a selection of grid  templates with fields associated with each field.

The user will be able to assign different content to different field locations, but they will not be allowed to negotiate the fonts and the ratios of the field dimensions. The user may wish to change the type of information associated with each Field, but they can not change the Field ratio. 

The program must dynamically fit the text image to the established grid. A preliminary list of behaviours is as follows:
all text should be converted to uppercase lettering
if the text is too large to fit in the field space at the default setting, or too small to cover the minimum area, the program will adjust kerning accordingly
each field will have respective character limitations, if passed, the program will either truncate the phrase to the last complete word -or- render the input invalid and move on to the next selection
when dealing with multiple quantities, the user will be able to input and place the  preposition
certain fields will only accept certain alphanumeric combinations. For example, the field associated with price and quantities should only accept numbers.     

OUTPUT:
The user will have print options where they can output to PDFs.This will remain fairly simple and constrained by the template itself unless we begin to find ways of creating batch creations and require more choices for output (i.e. double-sided printing). 





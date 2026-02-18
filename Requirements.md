## About this application:

We have two goals 

1 - Create a Claude skill to get information about Ryan Air flight:
- for that we will call ryan air api
- we have a postman definition on the resources folder
- The skill flow: the used need to say airport from souce and destination , aduls teens children and infants, the depart and return. Optional the user can say what time we can get the flight

- The return must be the cheapest , considering the flight time if provided.
- if I city has more than one airport we have to list the airports and ask the airport they want.
Example: Destination: Morocco, we need to ask Agadir, Marrakesh and Rabat.
https://www.ryanair.com/api/views/locate/5/airports/en/active would return the active aiports and the country and city are in the response.


2 - Second is to create a way to follow the prices, so the idea is to monitor the flight prices. 
- we need a way to save what is the search, get the price once a day, and alert if the new price is lower or under the target. 


Acceptance Criteria:

- To not overload the API we have to cache the query by url called. 
So let's say we call : https://www.ryanair.com/ie/en/trip/flights/select?adults=1&teens=0&children=0&infants=0&dateOut=2026-02-21&dateIn=2026-02-22&isConnectedFlight=false&discount=0&promoCode=&isReturn=true&originIata=DUB&destinationIata=LGW&tpAdults=1&tpTeens=0&tpChildren=0&tpInfants=0&tpStartDate=2026-02-21&tpEndDate=2026-02-22&tpDiscount=0&tpPromoCode=&tpOriginIata=DUB&tpDestinationIata=LGW
If we have a call to same endpoint in less than X time , we return the cached result.
https://www.ryanair.com/ie/en/trip/flights/select?adults=1&teens=0&children=0&infants=0&dateOut=2026-02-21&dateIn=2026-02-22&isConnectedFlight=false&discount=0&promoCode=&isReturn=true&originIata=DUB&destinationIata=LGW&tpAdults=1&tpTeens=0&tpChildren=0&tpInfants=0&tpStartDate=2026-02-21&tpEndDate=2026-02-22&tpDiscount=0&tpPromoCode=&tpOriginIata=DUB&tpDestinationIata=LGW



Links: 
- https://www.postman.com/hakkotsu/ryanair/overview
- https://github.com/2BAD/ryanair
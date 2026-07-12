package entities

type Route struct {
	ID              string `bson:"_id"             json:"id"`         
	OriginHub       string `bson:"originHub"       json:"originHub"`       
	DestHub         string `bson:"destHub"         json:"destHub"`   
	Legs            []Leg  `bson:"legs"            json:"legs"`            
	TotalDistanceKm float64 `bson:"totalDistanceKm" json:"totalDistanceKm"` 
	EstimatedMin    int    `bson:"estimatedMin"    json:"estimatedMin"`    
}

type Leg struct {
	FromHub    string  `bson:"fromHub"    json:"fromHub"`
	ToHub      string  `bson:"toHub"      json:"toHub"`
	DistanceKm float64 `bson:"distanceKm" json:"distanceKm"`
	PlannedMin int     `bson:"plannedMin" json:"plannedMin"`
}

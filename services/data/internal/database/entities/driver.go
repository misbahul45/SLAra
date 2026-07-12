package entities

type Driver struct {
	ID          string  `bson:"_id"         json:"id"`          
	Name        string  `bson:"name"        json:"name"`
	AvgDelayMin float64 `bson:"avgDelayMin" json:"avgDelayMin"` 
	TripCount   int     `bson:"tripCount"   json:"tripCount"`
}
